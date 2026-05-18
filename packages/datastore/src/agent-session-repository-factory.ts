import type { PrismaAgentSessionClient } from "./prisma-agent-session-repository.ts";
import { PrismaAgentSessionRepository } from "./prisma-agent-session-repository.ts";
import type { AgentSessionRepository } from "./agent-session-repository.ts";

export type AgentSessionRepositoryFactoryOptions = {
  prismaClient?: PrismaAgentSessionClient;
};

export function createAgentSessionRepository(
  options: AgentSessionRepositoryFactoryOptions = {},
): AgentSessionRepository {
  return new PrismaAgentSessionRepository({ client: options.prismaClient });
}
