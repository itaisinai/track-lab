import { PrismaTrackAnalysisJobRepository } from "../prisma-track-analysis-job-repository.ts";
import assert from "node:assert/strict";
import test from "node:test";

test("prisma track analysis job repository enqueues and processes jobs", async () => {
  const repository = new PrismaTrackAnalysisJobRepository({
    client: createMemoryClient() as never,
  });

  const queued = await repository.enqueue({
    operation: "analyze",
    payload: {
      operation: "analyze",
      track: { title: "Strobe", artists: "deadmau5" },
      source: "manual",
    },
  });

  assert.equal(queued.status, "queued");
  assert.equal(queued.attemptCount, 0);
  assert.equal((await repository.listJobs()).length, 1);

  const claimed = await repository.claimNextJob();
  assert.equal(claimed?.id, queued.id);
  assert.equal(claimed?.status, "processing");
  assert.equal(claimed?.attemptCount, 1);

  const completed = await repository.completeJob(queued.id, { ok: true });
  assert.equal(completed?.status, "completed");
  assert.deepEqual(completed?.result, { ok: true });

  assert.equal((await repository.listJobs({ unreadOnly: true })).length, 1);
  assert.equal(await repository.markNotificationRead(queued.id) !== null, true);
  assert.equal((await repository.listJobs({ unreadOnly: true })).length, 0);

  assert.equal((await repository.listJobs({ unresolvedOnly: true })).length, 1);
  assert.equal(await repository.resolveJob(queued.id) !== null, true);
  assert.equal((await repository.listJobs({ unresolvedOnly: true })).length, 0);
});

test("prisma track analysis job repository retries until dead lettered", async () => {
  const repository = new PrismaTrackAnalysisJobRepository({
    client: createMemoryClient() as never,
  });

  const queued = await repository.enqueue({
    operation: "enrich",
    maxAttempts: 2,
    payload: {
      operation: "enrich",
      track: { title: "Hot Honey", artists: "LIAD MEIR, Eden Derso" },
      source: "saved_result",
    },
  });

  await repository.claimNextJob();
  const retryable = await repository.failJob(queued.id, "provider failed");
  assert.equal(retryable?.status, "queued");
  assert.equal(retryable?.errorMessage, "provider failed");

  await repository.claimNextJob();
  const dead = await repository.failJob(queued.id, "provider failed again");
  assert.equal(dead?.status, "dead_lettered");
  assert.equal(dead?.completedAt !== null, true);

  const retried = await repository.retryJob(queued.id);
  assert.equal(retried?.status, "queued");
  assert.equal(retried?.errorMessage, null);
});

test("prisma track analysis job repository claims queued remix searches", async () => {
  const repository = new PrismaTrackAnalysisJobRepository({
    client: createMemoryClient() as never,
  });

  const queued = await repository.enqueue({
    operation: "remix_search",
    payload: {
      operation: "remix_search",
      request: {
        title: "Babatunde",
        artists: "Peekaboo",
        spotifyUrl: null,
        genre: "bass",
      },
    },
  });

  assert.equal((await repository.claimNextJob())?.id, queued.id);
});

test("prisma track analysis job repository reclaims stale processing jobs", async () => {
  const memoryClient = createMemoryClient();
  const repository = new PrismaTrackAnalysisJobRepository({
    client: memoryClient as never,
  });

  const queued = await repository.enqueue({
    operation: "remix_search",
    payload: {
      operation: "remix_search",
      request: {
        title: "The Less I Know The Better",
        artists: "Tame Impala",
        spotifyUrl: null,
        genre: "remix",
      },
    },
  });

  const row = memoryClient._state.find((entry) => entry.id === queued.id);
  if (!row) {
    throw new Error("test row not found");
  }

  row.status = "processing";
  row.updatedAt = "2000-01-01T00:00:00.000Z";

  assert.equal((await repository.claimNextJob())?.id, queued.id);
});

function createMemoryClient() {
  const state: Array<Record<string, unknown>> = [];
  let nextId = 1;

  return {
    _state: state,
    trackAnalysisJob: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: nextId++,
          ...data,
        };
        state.push(row);
        return row as never;
      },
      findMany: async ({ where }: { where?: Record<string, unknown>; orderBy?: unknown }) => {
        let rows = [...state];
        rows = rows.filter((row) => matchesWhere(row, where));
        return rows as never;
      },
      findUnique: async ({ where }: { where: { id: number } }) =>
        (state.find((row) => row.id === where.id) ?? null) as never,
      update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
        const row = state.find((entry) => entry.id === where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        return row as never;
      },
    },
    $transaction: async <T>(callback: (client: any) => Promise<T>) =>
      callback({
        $queryRaw: async () =>
          state
            .filter(
              (row) =>
                row.status === "queued" ||
                (row.status === "processing" &&
                  new Date(String(row.updatedAt)).valueOf() <= Date.now() - 5 * 60 * 1000),
            )
            .sort((left, right) => {
              const leftPriority = left.status === "queued" ? 0 : 1;
              const rightPriority = right.status === "queued" ? 0 : 1;

              if (leftPriority !== rightPriority) {
                return leftPriority - rightPriority;
              }

              return (
                new Date(String(left.createdAt)).valueOf() -
                new Date(String(right.createdAt)).valueOf()
              );
            })
            .slice(0, 1),
        trackAnalysisJob: {
          update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
            const row = state.find((entry) => entry.id === where.id);
            if (!row) throw new Error("not found");
            if (data.attemptCount && typeof data.attemptCount === "object") {
              row.attemptCount = Number(row.attemptCount ?? 0) + 1;
            }
            Object.assign(row, {
              ...data,
              attemptCount: row.attemptCount,
            });
            return row;
          },
        },
      }),
  };
}

function matchesWhere(
  row: Record<string, unknown>,
  where?: Record<string, unknown>,
): boolean {
  if (!where) {
    return true;
  }

  if (Array.isArray(where.AND)) {
    return where.AND.every((entry) => matchesWhere(row, entry as Record<string, unknown>));
  }

  if (where.status && typeof where.status === "object") {
    const statuses = (where.status as { in?: string[] }).in;
    if (statuses && !statuses.includes(String(row.status))) {
      return false;
    }
  }

  if (where.resolvedAt === null && row.resolvedAt !== null) {
    return false;
  }

  if (where.notificationReadAt === null && row.notificationReadAt !== null) {
    return false;
  }

  return true;
}
