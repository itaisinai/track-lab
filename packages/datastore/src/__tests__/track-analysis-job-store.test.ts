import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TrackAnalysisJobStore } from "../track-analysis-job-store.ts";

test("job store enqueues, claims, completes, reads, and resolves jobs", () => {
  const store = createStore();
  const queued = store.enqueue({
    operation: "analyze",
    payload: {
      operation: "analyze",
      track: { title: "Strobe", artists: "deadmau5" },
      source: "manual",
    },
  });

  assert.equal(queued.status, "queued");
  assert.equal(queued.attemptCount, 0);

  const claimed = store.claimNextJob();
  assert.equal(claimed?.id, queued.id);
  assert.equal(claimed?.status, "processing");
  assert.equal(claimed?.attemptCount, 1);

  const completed = store.completeJob(queued.id, { ok: true });
  assert.equal(completed?.status, "completed");
  assert.deepEqual(completed?.result, { ok: true });
  assert.equal(completed?.notificationReadAt, null);
  assert.equal(completed?.resolvedAt, null);

  assert.equal(store.listJobs({ unreadOnly: true }).length, 1);
  assert.equal(store.markNotificationRead(queued.id)?.notificationReadAt !== null, true);
  assert.equal(store.listJobs({ unreadOnly: true }).length, 0);

  assert.equal(store.listJobs({ unresolvedOnly: true }).length, 1);
  assert.equal(store.resolveJob(queued.id)?.resolvedAt !== null, true);
  assert.equal(store.listJobs({ unresolvedOnly: true }).length, 0);
});

test("job store retries failed jobs until max attempts then dead letters", () => {
  const store = createStore();
  const queued = store.enqueue({
    operation: "enrich",
    maxAttempts: 2,
    payload: {
      operation: "enrich",
      track: { title: "Hot Honey", artists: "LIAD MEIR, Eden Derso" },
      source: "saved_result",
    },
  });

  assert.equal(store.claimNextJob()?.attemptCount, 1);
  const retryable = store.failJob(queued.id, "provider failed");
  assert.equal(retryable?.status, "queued");
  assert.equal(retryable?.errorMessage, "provider failed");

  assert.equal(store.claimNextJob()?.attemptCount, 2);
  const dead = store.failJob(queued.id, "provider failed again");
  assert.equal(dead?.status, "dead_lettered");
  assert.equal(dead?.completedAt !== null, true);

  const retried = store.retryJob(queued.id);
  assert.equal(retried?.status, "queued");
  assert.equal(retried?.errorMessage, null);
});

function createStore() {
  const directory = mkdtempSync(join(tmpdir(), "track-lab-jobs-"));
  return new TrackAnalysisJobStore(join(directory, "test.sqlite"));
}
