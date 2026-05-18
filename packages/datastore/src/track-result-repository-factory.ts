import { PrismaTrackResultRepository } from "./prisma-track-result-repository.ts";
import type { TrackResultRepository } from "./track-result-repository.ts";
import type { PrismaTrackResultClient } from "./prisma-track-result-repository.ts";

export type TrackResultRepositoryFactoryOptions = {
  prismaClient?: PrismaTrackResultClient;
};

export function createTrackResultRepository(
  options: TrackResultRepositoryFactoryOptions = {},
): TrackResultRepository {
  return new PrismaTrackResultRepository(options.prismaClient);
}
