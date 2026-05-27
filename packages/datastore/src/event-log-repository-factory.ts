import { PrismaEventLogRepository } from "./prisma-event-log-repository.ts";

export function createEventLogRepository() {
  return new PrismaEventLogRepository();
}
