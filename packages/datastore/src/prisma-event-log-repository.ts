import type { DomainEvent } from "./types.ts";
import { createPrismaDatastoreClient, type PrismaDatastoreClient } from "./prisma-datastore-client.ts";
import type { EventLogRepository } from "./event-log-repository.ts";

type PrismaEventLogRow = {
  id: string;
  eventType: string;
  version: number;
  occurredAt: Date;
  correlationId: string;
  causationId: string | null;
  producer: string;
  idempotencyKey: string;
  payload: unknown;
};

type PrismaEventLogDelegate = {
  create(args: {
    data: Record<string, unknown>;
  }): Promise<PrismaEventLogRow>;
  findMany(args: {
    where?: Record<string, unknown>;
    orderBy: Array<Record<string, unknown>>;
  }): Promise<PrismaEventLogRow[]>;
};

export type PrismaEventLogClient = PrismaDatastoreClient & {
  eventLog: PrismaEventLogDelegate;
};

export type PrismaEventLogRepositoryOptions = {
  client?: PrismaEventLogClient;
};

export class PrismaEventLogRepository implements EventLogRepository {
  private readonly client: PrismaEventLogClient;

  constructor(options: PrismaEventLogRepositoryOptions = {}) {
    this.client = options.client ?? (createPrismaDatastoreClient() as PrismaEventLogClient);
  }

  async append(event: DomainEvent): Promise<{ inserted: boolean }> {
    try {
      await this.client.eventLog.create({
        data: {
          id: event.eventId,
          eventType: event.eventType,
          version: event.version,
          occurredAt: new Date(event.occurredAt),
          correlationId: event.correlationId,
          causationId: event.causationId ?? null,
          producer: event.producer,
          idempotencyKey: event.idempotencyKey,
          payload: event.payload,
        },
      });

      return { inserted: true };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { inserted: false };
      }

      throw error;
    }
  }

  async listByCorrelationId(correlationId: string): Promise<DomainEvent[]> {
    const rows = await this.client.eventLog.findMany({
      where: { correlationId },
      orderBy: [{ occurredAt: "asc" }],
    });

    return rows.map(mapRowToDomainEvent);
  }
}

function mapRowToDomainEvent(row: PrismaEventLogRow): DomainEvent {
  return {
    eventId: row.id,
    eventType: row.eventType,
    version: row.version,
    occurredAt: row.occurredAt.toISOString(),
    correlationId: row.correlationId,
    causationId: row.causationId ?? undefined,
    producer: row.producer,
    idempotencyKey: row.idempotencyKey,
    payload: row.payload,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown };
  return record.code === "P2002" || record.code === "23505";
}
