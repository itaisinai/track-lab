import assert from "node:assert/strict";
import test from "node:test";
import { PrismaEventLogRepository } from "../prisma-event-log-repository.ts";
import type { DomainEvent } from "../types.ts";

test("prisma event log repository inserts events idempotently", async () => {
  const client = createMemoryClient();
  const repository = new PrismaEventLogRepository({ client: client as never });
  const event: DomainEvent = {
    eventId: "00000000-0000-0000-0000-000000000001",
    eventType: "TrackAnalysisStarted",
    version: 1,
    occurredAt: "2026-05-25T10:00:00.000Z",
    correlationId: "00000000-0000-0000-0000-000000000002",
    causationId: "00000000-0000-0000-0000-000000000003",
    producer: "apps/worker",
    idempotencyKey: "track-analysis-job:1:attempt:1:started",
    payload: {
      jobId: 1,
      status: "analyzing",
    },
  };

  assert.deepEqual(await repository.append(event), { inserted: true });
  assert.deepEqual(await repository.append(event), { inserted: false });
  assert.equal(client._state.length, 1);

  const listed = await repository.listByCorrelationId(event.correlationId);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.eventType, "TrackAnalysisStarted");
});

function createMemoryClient() {
  const state: Array<Record<string, unknown>> = [];

  return {
    _state: state,
    eventLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (
          state.some(
            (row) => row.idempotencyKey === data.idempotencyKey,
          )
        ) {
          const error = new Error("unique violation") as Error & { code?: string };
          error.code = "P2002";
          throw error;
        }

        const row = {
          ...data,
          createdAt: new Date(),
        };
        state.push(row);
        return row as never;
      },
      findMany: async ({ where }: { where?: Record<string, unknown>; orderBy?: unknown }) =>
        state
          .filter((row) =>
            where?.correlationId
              ? row.correlationId === where.correlationId
              : true,
          )
          .sort(
            (left, right) =>
              new Date(String(left.occurredAt)).valueOf() -
              new Date(String(right.occurredAt)).valueOf(),
          ) as never,
    },
  };
}
