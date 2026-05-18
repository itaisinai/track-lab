import type { PrismaRemixResultClient } from "./prisma-remix-result-repository.ts";
import { PrismaRemixResultRepository } from "./prisma-remix-result-repository.ts";
import type { RemixResultRepository } from "./remix-result-repository.ts";

export type RemixResultRepositoryFactoryOptions = {
  prismaClient?: PrismaRemixResultClient;
};

export function createRemixResultRepository(
  options: RemixResultRepositoryFactoryOptions = {},
): RemixResultRepository {
  return new PrismaRemixResultRepository({ client: options.prismaClient });
}
