import type { PrismaAgentSessionClient } from "./prisma-agent-session-repository.ts";
import { PrismaAgentSessionRepository } from "./prisma-agent-session-repository.ts";
import { AgentSessionStore } from "./agent-session-store.ts";
import type { AgentSessionRepository } from "./agent-session-repository.ts";

export type AgentSessionRepositoryFactoryOptions = {
  sqliteDatabasePath?: string;
  prismaClient?: PrismaAgentSessionClient;
};

export function createAgentSessionRepository(
  options: AgentSessionRepositoryFactoryOptions = {},
): AgentSessionRepository {
  return process.env.DATASTORE_PROVIDER === "prisma"
    ? new PrismaAgentSessionRepository({ client: options.prismaClient })
    : new AgentSessionStore(options.sqliteDatabasePath);
}
