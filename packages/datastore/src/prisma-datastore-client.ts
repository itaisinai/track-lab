import { PrismaPg } from "@prisma/adapter-pg";
import { ensureRootEnvLoaded } from "./load-root-env.ts";
import { PrismaClient } from "./prisma-client.ts";

export type PrismaDatastoreClient = PrismaClient;

export function createPrismaDatastoreClient(): PrismaDatastoreClient {
  ensureRootEnvLoaded();

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required for Prisma datastore access. Load the root .env or set DATABASE_URL before using the Prisma provider.",
    );
  }

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });

  return new PrismaClient({ adapter });
}
