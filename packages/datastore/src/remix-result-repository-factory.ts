import type { PrismaRemixResultClient } from "./prisma-remix-result-repository.ts";
import { PrismaRemixResultRepository } from "./prisma-remix-result-repository.ts";
import { RemixResultStore } from "./remix-result-store.ts";
import type { RemixResultRepository } from "./remix-result-repository.ts";

export type RemixResultRepositoryFactoryOptions = {
  sqliteDatabasePath?: string;
  prismaClient?: PrismaRemixResultClient;
};

export function createRemixResultRepository(
  options: RemixResultRepositoryFactoryOptions = {},
): RemixResultRepository {
  return process.env.DATASTORE_PROVIDER === "prisma"
    ? new PrismaRemixResultRepository({ client: options.prismaClient })
    : new RemixResultStore(options.sqliteDatabasePath);
}
