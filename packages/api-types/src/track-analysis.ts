import type { RemixSearchRequest } from "./remix-search.ts";

export type TrackAnalysisOperation = "analyze" | "enrich" | "remix_search";

export type TrackAnalysisJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "dead_lettered";

export type TrackAnalysisKnownMetadata = Partial<{
  album: string | null;
  bpm: number | null;
  genre: string | null;
  subGenre: string | null;
  key: string | null;
  spotifyUrl: string | null;
}>;

export type TrackAnalysisSource =
  | "manual"
  | "saved_result"
  | "bulk_saved_results";

export type TrackMetadataAnalysisPayload = {
  operation: "analyze" | "enrich";
  track: {
    title: string;
    artists: string;
  };
  knownMetadata?: TrackAnalysisKnownMetadata;
  source?: TrackAnalysisSource;
};

export type RemixSearchJobPayload = {
  operation: "remix_search";
  request: RemixSearchRequest;
};

export type TrackAnalysisPayload =
  | (TrackMetadataAnalysisPayload & { operation: "analyze" | "enrich" })
  | RemixSearchJobPayload;

export type TrackAnalysisJob = {
  id: number;
  operation: TrackAnalysisOperation;
  status: TrackAnalysisJobStatus;
  payload: TrackAnalysisPayload;
  result: unknown | null;
  errorMessage: string | null;
  attemptCount: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  notificationReadAt: string | null;
  resolvedAt: string | null;
};

export type EnqueueTrackAnalysisRequest = TrackAnalysisPayload;

export type EnqueueTrackAnalysisResponse = {
  job: Pick<TrackAnalysisJob, "id" | "status">;
};

export type EnqueueRemixSearchResponse = EnqueueTrackAnalysisResponse;

export type ListTrackAnalysisJobsResponse = {
  jobs: TrackAnalysisJob[];
};

export type TrackAnalysisJobResponse = {
  job: TrackAnalysisJob;
};
