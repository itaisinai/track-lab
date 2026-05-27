import type { DomainEvent } from "./types.ts";
import type { MaybePromise } from "./repository.ts";

export interface EventLogRepository {
  append(event: DomainEvent): MaybePromise<{ inserted: boolean }>;
  listByCorrelationId(correlationId: string): MaybePromise<DomainEvent[]>;
}
