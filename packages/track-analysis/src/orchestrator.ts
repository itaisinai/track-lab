import {
  TrackAnalysisJobStore,
  type TrackAnalysisJob,
  type TrackAnalysisKnownMetadata,
  type TrackAnalysisOperation,
  type TrackAnalysisPayload,
  type TrackAnalysisSource,
} from "@track-lab/datastore";

export type EnqueueTrackAnalysisRequest = {
  operation: TrackAnalysisOperation;
  track: {
    title: string;
    artists: string;
  };
  knownMetadata?: TrackAnalysisKnownMetadata;
  source?: TrackAnalysisSource;
};

export class TrackAnalysisOrchestrator {
  private readonly jobs: TrackAnalysisJobStore;

  constructor(jobs = new TrackAnalysisJobStore()) {
    this.jobs = jobs;
  }

  enqueue(request: EnqueueTrackAnalysisRequest): TrackAnalysisJob {
    const payload = validateRequest(request);

    return this.jobs.enqueue({
      operation: payload.operation,
      payload,
    });
  }
}

function validateRequest(request: EnqueueTrackAnalysisRequest): TrackAnalysisPayload {
  if (request.operation !== "analyze" && request.operation !== "enrich") {
    throw new Error("Operation must be analyze or enrich.");
  }

  const title = request.track?.title?.trim();
  const artists = request.track?.artists?.trim();

  if (!title || !artists) {
    throw new Error("Track title and artists are required.");
  }

  return {
    operation: request.operation,
    track: {
      title,
      artists,
    },
    knownMetadata: normalizeKnownMetadata(request.knownMetadata),
    source: request.source ?? "manual",
  };
}

function normalizeKnownMetadata(
  knownMetadata: TrackAnalysisKnownMetadata | undefined,
) {
  if (!knownMetadata) {
    return undefined;
  }

  return {
    album: knownMetadata.album ?? null,
    bpm: knownMetadata.bpm ?? null,
    genre: knownMetadata.genre ?? null,
    subGenre: knownMetadata.subGenre ?? null,
    key: knownMetadata.key ?? null,
    spotifyUrl: knownMetadata.spotifyUrl ?? null,
  };
}
