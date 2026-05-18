import type { TrackResultRepository } from "@track-lab/datastore";
import { createTrackResultRepository } from "@track-lab/datastore";

let repository: TrackResultRepository | null = null;

export function getEnrichmentTrackResultRepository(): TrackResultRepository {
  if (!repository) {
    repository = createTrackResultRepository();
  }

  return repository;
}
