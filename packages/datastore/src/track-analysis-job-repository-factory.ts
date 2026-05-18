import type { PrismaTrackAnalysisJobClient } from "./prisma-track-analysis-job-repository.ts";
import { PrismaTrackAnalysisJobRepository } from "./prisma-track-analysis-job-repository.ts";
import { TrackAnalysisJobStore } from "./track-analysis-job-store.ts";
import type { TrackAnalysisJobRepository } from "./track-analysis-job-repository.ts";

export type TrackAnalysisJobRepositoryFactoryOptions = {
  sqliteDatabasePath?: string;
  prismaClient?: PrismaTrackAnalysisJobClient;
};

export function createTrackAnalysisJobRepository(
  options: TrackAnalysisJobRepositoryFactoryOptions = {},
): TrackAnalysisJobRepository {
  return process.env.DATASTORE_PROVIDER === "prisma"
    ? new PrismaTrackAnalysisJobRepository({ client: options.prismaClient })
    : new TrackAnalysisJobStore(options.sqliteDatabasePath);
}
