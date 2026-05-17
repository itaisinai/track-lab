import { PrismaTrackResultRepository } from "./prisma-track-result-repository.ts";
import { TrackResultStore } from "./track-result-store.ts";
import type { TrackResultRepository } from "./track-result-repository.ts";
import type { PrismaTrackResultClient } from "./prisma-track-result-repository.ts";

export type TrackResultRepositoryFactoryOptions = {
  sqliteDatabasePath?: string;
  prismaClient?: PrismaTrackResultClient;
};

export function createTrackResultRepository(
  options: TrackResultRepositoryFactoryOptions = {},
): TrackResultRepository {
  return process.env.DATASTORE_PROVIDER === "prisma"
    ? new PrismaTrackResultRepository(options.prismaClient)
    : new TrackResultStore(options.sqliteDatabasePath);
}
