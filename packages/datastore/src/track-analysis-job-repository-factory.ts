import type { PrismaTrackAnalysisJobClient } from "./prisma-track-analysis-job-repository.ts";
import { PrismaTrackAnalysisJobRepository } from "./prisma-track-analysis-job-repository.ts";
import type { TrackAnalysisJobRepository } from "./track-analysis-job-repository.ts";

export type TrackAnalysisJobRepositoryFactoryOptions = {
  prismaClient?: PrismaTrackAnalysisJobClient;
};

export function createTrackAnalysisJobRepository(
  options: TrackAnalysisJobRepositoryFactoryOptions = {},
): TrackAnalysisJobRepository {
  return new PrismaTrackAnalysisJobRepository({ client: options.prismaClient });
}
