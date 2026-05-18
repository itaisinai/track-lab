import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  TrackAnalysisJobStore,
  type TrackAnalysisQueueProvider,
} from "@track-lab/datastore";
import { TrackAnalysisOrchestrator, TrackAnalysisWorker } from "../index.ts";

test("orchestrator validates and enqueues analyze and enrich requests", async () => {
  const store = createStore();
  const queue = createQueue();
  const orchestrator = new TrackAnalysisOrchestrator(store, queue);

  const analyze = await orchestrator.enqueue({
    operation: "analyze",
    track: { title: " Strobe ", artists: " deadmau5 " },
  });
  const enrich = await orchestrator.enqueue({
    operation: "enrich",
    track: { title: "Hot Honey", artists: "LIAD MEIR, Eden Derso" },
    knownMetadata: { bpm: 126 },
    source: "saved_result",
  });

  assert.equal(analyze.status, "queued");
  assert.deepEqual(analyze.payload, {
    operation: "analyze",
    track: { title: "Strobe", artists: "deadmau5" },
    source: "manual",
  });
  assert.equal(enrich.operation, "enrich");
  assert.equal(store.listJobs().length, 2);
  assert.deepEqual(queue.enqueuedJobIds, [analyze.id, enrich.id]);
});

test("orchestrator enqueues job ids to the configured queue provider", async () => {
  const store = createStore();
  const queue = createQueue();
  const orchestrator = new TrackAnalysisOrchestrator(store, queue);

  const queued = await orchestrator.enqueue({
    operation: "analyze",
    track: { title: "Strobe", artists: "deadmau5" },
  });

  assert.deepEqual(queue.enqueuedJobIds, [queued.id]);
});

test("worker completes successful jobs", async () => {
  const store = createStore();
  const orchestrator = new TrackAnalysisOrchestrator(store);
  const queued = await orchestrator.enqueue({
    operation: "analyze",
    track: { title: "Strobe", artists: "deadmau5" },
  });
  const worker = new TrackAnalysisWorker(store, {
    processor: async (payload) => {
      if (payload.operation === "remix_search") {
        throw new Error("unexpected remix search payload");
      }

      return { title: payload.track.title, ok: true };
    },
  });

  const completed = await worker.processNextJob();

  assert.equal(completed?.id, queued.id);
  assert.equal(completed?.status, "completed");
  assert.deepEqual(completed?.result, { title: "Strobe", ok: true });
});

test("worker processes sqs messages and deletes them after success", async () => {
  const store = createStore();
  const queue = createQueue({
    messages: [{ body: JSON.stringify({ jobId: 1 }), receiptHandle: "receipt-1" }],
  });

  const orchestrator = new TrackAnalysisOrchestrator(store, queue);
  const queued = await orchestrator.enqueue({
    operation: "analyze",
    track: { title: "Strobe", artists: "deadmau5" },
  });

  const worker = new TrackAnalysisWorker(
    store,
    {
      processor: async (payload) => {
        if (payload.operation !== "analyze") {
          throw new Error("unexpected remix search payload");
        }

        return { title: payload.track.title, ok: true };
      },
    },
    queue,
  );

  const completed = await worker.processNextJob();

  assert.equal(completed?.id, queued.id);
  assert.equal(completed?.status, "completed");
  assert.deepEqual(completed?.result, { title: "Strobe", ok: true });
  assert.deepEqual(queue.deletedReceipts, ["receipt-1"]);
});

test("worker retries failures and dead letters exhausted jobs", async () => {
  const store = createStore();
  const queued = store.enqueue({
    operation: "analyze",
    maxAttempts: 2,
    payload: {
      operation: "analyze",
      track: { title: "Strobe", artists: "deadmau5" },
    },
  });
  const worker = new TrackAnalysisWorker(store, {
    processor: async () => {
      throw new Error("lookup failed");
    },
  });

  const retryable = await worker.processNextJob();
  assert.equal(retryable?.status, "queued");
  assert.equal(retryable?.errorMessage, "lookup failed");

  const dead = await worker.processNextJob();
  assert.equal(dead?.id, queued.id);
  assert.equal(dead?.status, "dead_lettered");
  assert.equal(dead?.attemptCount, 2);
});

test("orchestrator validates and enqueues remix search requests", async () => {
  const store = createStore();
  const orchestrator = new TrackAnalysisOrchestrator(store);

  const queued = await orchestrator.enqueue({
    operation: "remix_search",
    request: {
      title: " Babatunde ",
      artists: " Peekaboo ",
      genre: " bass ",
    },
  });

  assert.equal(queued.operation, "remix_search");
  assert.deepEqual(queued.payload, {
    operation: "remix_search",
    request: {
      title: "Babatunde",
      artists: "Peekaboo",
      spotifyUrl: null,
      genre: "bass",
    },
  });
});

function createStore() {
  const directory = mkdtempSync(join(tmpdir(), "track-lab-analysis-"));
  return new TrackAnalysisJobStore(join(directory, "test.sqlite"));
}

function createQueue(initial: {
  messages?: Array<{ body: string; receiptHandle: string }>;
} = {}): TrackAnalysisQueueProvider & {
  enqueuedJobIds: number[];
  deletedReceipts: string[];
} {
  const messages = [...(initial.messages ?? [])];
  const enqueuedJobIds: number[] = [];
  const deletedReceipts: string[] = [];

  return {
    mode: "sqs",
    enqueuedJobIds,
    deletedReceipts,
    async enqueue(jobId: number) {
      enqueuedJobIds.push(jobId);
    },
    async receiveNextMessage() {
      const message = messages.shift();
      return message ? { body: message.body, receiptHandle: message.receiptHandle } : null;
    },
    async deleteMessage(message: { receiptHandle?: string }) {
      if (message.receiptHandle) {
        deletedReceipts.push(message.receiptHandle);
      }
    },
  };
}
