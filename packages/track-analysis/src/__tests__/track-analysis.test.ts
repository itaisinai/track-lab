import assert from "node:assert/strict";
import test from "node:test";
import {
  type EventLogRepository,
  PrismaTrackAnalysisJobRepository,
  type TrackAnalysisQueueCommand,
  type TrackAnalysisQueueProvider,
} from "@track-lab/datastore";
import type { DomainEvent } from "@track-lab/api-types";
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
  assert.equal((await store.listJobs()).length, 2);
  assert.equal(getCommandJobId(queue.enqueuedCommands[0]), analyze.id);
  assert.equal(queue.enqueuedCommands[1], enrich.id);
});

test("orchestrator enqueues analyze commands to the configured queue provider", async () => {
  const store = createStore();
  const queue = createQueue();
  const orchestrator = new TrackAnalysisOrchestrator(store, queue);

  const queued = await orchestrator.enqueue({
    operation: "analyze",
    track: { title: "Strobe", artists: "deadmau5" },
  });

  assert.equal(getCommandJobId(queue.enqueuedCommands[0]), queued.id);
});

test("worker completes successful jobs", async () => {
  const store = createStore();
  const events = createEventStore();
  const orchestrator = new TrackAnalysisOrchestrator(store);
  const queued = await orchestrator.enqueue({
    operation: "analyze",
    track: { title: "Strobe", artists: "deadmau5" },
  });
  const worker = new TrackAnalysisWorker(
    store,
    {
      processor: async (payload) => {
        if (payload.operation === "remix_search") {
          throw new Error("unexpected remix search payload");
        }

        return { title: payload.track.title, ok: true };
      },
    },
    createDatabaseQueue(),
    events,
  );

  const completed = await worker.processNextJob();

  assert.equal(completed?.id, queued.id);
  assert.equal(completed?.status, "completed");
  assert.deepEqual(completed?.result, { title: "Strobe", ok: true });
  assert.deepEqual(events.eventTypes(), [
    "TrackAnalysisStarted",
    "TrackAnalysisCompleted",
  ]);
  assert.equal((events.events[0]?.payload as { status?: string }).status, "analyzing");
});

test("worker processes sqs messages and deletes them after success", async () => {
  const store = createStore();
  const events = createEventStore();
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
    events,
  );

  const completed = await worker.processNextJob();

  assert.equal(completed?.id, queued.id);
  assert.equal(completed?.status, "completed");
  assert.deepEqual(completed?.result, { title: "Strobe", ok: true });
  assert.deepEqual(queue.deletedReceipts, ["receipt-1"]);
  assert.deepEqual(events.eventTypes(), [
    "TrackAnalysisStarted",
    "TrackAnalysisCompleted",
  ]);
});

test("worker falls back to queued database jobs when sqs has no message", async () => {
  const store = createStore();
  const events = createEventStore();
  const queue = createQueue();
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

        return { title: payload.track.title, repaired: true };
      },
    },
    queue,
    events,
  );

  const completed = await worker.processNextJob();

  assert.equal(completed?.id, queued.id);
  assert.equal(completed?.status, "completed");
  assert.deepEqual(completed?.result, { title: "Strobe", repaired: true });
  assert.deepEqual(events.eventTypes(), [
    "TrackAnalysisStarted",
    "TrackAnalysisCompleted",
  ]);
});

test("worker dead letters failures for user retry", async () => {
  const store = createStore();
  const events = createEventStore();
  const queued = await store.enqueue({
    operation: "analyze",
    maxAttempts: 2,
    payload: {
      operation: "analyze",
      track: { title: "Strobe", artists: "deadmau5" },
    },
  });
  const worker = new TrackAnalysisWorker(
    store,
    {
      processor: async () => {
        throw new Error("lookup failed");
      },
    },
    createDatabaseQueue(),
    events,
  );

  const dead = await worker.processNextJob();
  assert.equal(dead?.id, queued.id);
  assert.equal(dead?.status, "failed");
  assert.equal(dead?.attemptCount, 1);
  assert.equal(dead?.errorMessage, "lookup failed");
  assert.deepEqual(events.eventTypes(), [
    "TrackAnalysisStarted",
    "TrackAnalysisFailed",
  ]);
  assert.equal(
    (events.events[1]?.payload as { errorMessage?: string }).errorMessage,
    "lookup failed",
  );
});

test("worker deletes sqs messages after dead lettering failures", async () => {
  const store = createStore();
  const events = createEventStore();
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
      processor: async () => {
        throw new Error("provider failed");
      },
    },
    queue,
    events,
  );

  const dead = await worker.processNextJob();

  assert.equal(dead?.id, queued.id);
  assert.equal(dead?.status, "failed");
  assert.equal(dead?.errorMessage, "provider failed");
  assert.deepEqual(queue.deletedReceipts, ["receipt-1"]);
  assert.equal(getCommandJobId(queue.enqueuedCommands[0]), queued.id);
  assert.deepEqual(events.eventTypes(), [
    "TrackAnalysisStarted",
    "TrackAnalysisFailed",
  ]);
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
  return new PrismaTrackAnalysisJobRepository({
    client: createMemoryClient() as never,
  });
}

function createQueue(initial: {
  messages?: Array<{ body: string; receiptHandle: string }>;
} = {}): TrackAnalysisQueueProvider & {
  enqueuedCommands: TrackAnalysisQueueCommand[];
  deletedReceipts: string[];
} {
  const messages = [...(initial.messages ?? [])];
  const enqueuedCommands: TrackAnalysisQueueCommand[] = [];
  const deletedReceipts: string[] = [];

  return {
    mode: "sqs",
    enqueuedCommands,
    deletedReceipts,
    async enqueue(command: TrackAnalysisQueueCommand) {
      enqueuedCommands.push(command);
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

function createDatabaseQueue(): TrackAnalysisQueueProvider {
  return {
    mode: "database",
    async enqueue() {},
    async receiveNextMessage() {
      return null;
    },
    async deleteMessage() {},
  };
}

function createEventStore(): EventLogRepository & {
  events: DomainEvent[];
  eventTypes: () => string[];
} {
  const events: DomainEvent[] = [];

  return {
    events,
    eventTypes: () => events.map((event) => event.eventType),
    async append(event: DomainEvent) {
      if (
        events.some(
          (existing) => existing.idempotencyKey === event.idempotencyKey,
        )
      ) {
        return { inserted: false };
      }

      events.push(event);
      return { inserted: true };
    },
    async listByCorrelationId(correlationId: string) {
      return events.filter((event) => event.correlationId === correlationId);
    },
  };
}

function getCommandJobId(command: TrackAnalysisQueueCommand | undefined) {
  if (typeof command === "number") {
    return command;
  }

  return command?.payload.jobId;
}

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
        if (data.attemptCount && typeof data.attemptCount === "object") {
          row.attemptCount = Number(row.attemptCount ?? 0) + 1;
        }
        Object.assign(row, {
          ...data,
          attemptCount: row.attemptCount,
        });
        return row as never;
      },
    },
    $transaction: async <T>(callback: (client: any) => Promise<T>) =>
      callback({
        $queryRaw: async () => {
          const candidate = [...state]
            .filter(
              (row) =>
                row.status === "queued" ||
                ((row.status === "analyzing" || row.status === "processing") &&
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
            })[0];

          if (!candidate) {
            return [];
          }

          candidate.status = "analyzing";
          candidate.attemptCount = Number(candidate.attemptCount ?? 0) + 1;
          candidate.errorMessage = null;
          candidate.updatedAt = new Date();

          return [
            {
              id: candidate.id,
              operation: candidate.operation,
              status: candidate.status,
              payload_json: candidate.payloadJson,
              result_json: candidate.resultJson,
              error_message: candidate.errorMessage,
              attempt_count: candidate.attemptCount,
              max_attempts: candidate.maxAttempts,
              command_id: candidate.commandId ?? null,
              correlation_id: candidate.correlationId ?? null,
              created_at: candidate.createdAt,
              updated_at: candidate.updatedAt,
              completed_at: candidate.completedAt,
              notification_read_at: candidate.notificationReadAt,
              resolved_at: candidate.resolvedAt,
            },
          ];
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
