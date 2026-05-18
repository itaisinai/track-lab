import type { EnqueueTrackAnalysisRequest } from "@track-lab/api-types";
import {
  createTrackAnalysisJobRepository,
  type TrackAnalysisJobRepository,
  type TrackAnalysisJob,
  type TrackAnalysisKnownMetadata,
  type TrackAnalysisPayload,
} from "@track-lab/datastore";

export class TrackAnalysisOrchestrator {
  private readonly jobs: TrackAnalysisJobRepository;

  constructor(jobs = createTrackAnalysisJobRepository()) {
    this.jobs = jobs;
  }

  async enqueue(request: EnqueueTrackAnalysisRequest): Promise<TrackAnalysisJob> {
    const payload = validateRequest(request);

    return this.jobs.enqueue({
      operation: payload.operation,
      payload,
    });
  }
}

function validateRequest(request: EnqueueTrackAnalysisRequest): TrackAnalysisPayload {
  if (request.operation === "remix_search") {
    const title = request.request.title?.trim();
    const artists = request.request.artists?.trim();
    const spotifyUrl = request.request.spotifyUrl?.trim();

    if (!spotifyUrl && (!title || !artists)) {
      throw new Error("Provide a Spotify URL or both title and artists.");
    }

    return {
      operation: "remix_search",
      request: {
        title: title || null,
        artists: artists || null,
        spotifyUrl: spotifyUrl || null,
        genre: request.request.genre?.trim() || null,
      },
    };
  }

  if (request.operation !== "analyze" && request.operation !== "enrich") {
    throw new Error("Operation must be analyze, enrich, or remix_search.");
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
