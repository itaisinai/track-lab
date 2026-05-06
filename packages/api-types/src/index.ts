export type ResultStatus = "complete" | "partial" | "failed";

export type ProviderStatus = {
  name: string;
  matched: boolean | null;
  url: string | null;
  error: string | null;
};

export type ResultError = {
  source: string;
  message: string;
};

export type TrackDetails = {
  title?: string;
  artists?: string;
  album?: string;
  bpm?: string;
  genre?: string;
  subGenre?: string;
  key?: string;
  summary?: string;
  spotifyUrl?: string;
  toolsUsed?: ProviderStatus[];
  changedFields?: Array<
    "album" | "bpm" | "genre" | "subGenre" | "key" | "spotifyUrl"
  >;
  reviewNotes?: string[];
  conflicts?: string[];
  errors?: ResultError[];
};

export type SavedTrackResult = {
  id: number;
  title: string;
  artists: string;
  album: string | null;
  bpm: number | null;
  genre: string | null;
  subGenre: string | null;
  key: string | null;
  summary: string | null;
  status: ResultStatus;
  toolsUsed: ProviderStatus[];
  errors: ResultError[];
  json: unknown;
  rawResponse: string;
  createdAt: string;
  updatedAt: string;
};

export type SaveTrackResultInput = {
  rawResponse: string;
  json: unknown;
};

export type NormalizedTrackResult = Omit<
  SavedTrackResult,
  "id" | "json" | "rawResponse" | "createdAt" | "updatedAt"
>;

export type TrackAnalysisOperation = "analyze" | "enrich";

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

export type TrackAnalysisPayload = {
  operation: TrackAnalysisOperation;
  track: {
    title: string;
    artists: string;
  };
  knownMetadata?: TrackAnalysisKnownMetadata;
  source?: TrackAnalysisSource;
};

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

export type ListSavedResultsResponse = {
  results: SavedTrackResult[];
};

export type SaveTrackResultResponse = {
  result: SavedTrackResult;
};

export type ListTrackAnalysisJobsResponse = {
  jobs: TrackAnalysisJob[];
};

export type TrackAnalysisJobResponse = {
  job: TrackAnalysisJob;
};

export type RemixSearchRequest = {
  title?: string | null;
  artists?: string | null;
  spotifyUrl?: string | null;
  genre?: string | null;
};

export type RemixSearchOriginalTrack = {
  title: string;
  artists: string;
  spotifyUrl?: string | null;
  album?: string | null;
  durationMs?: number | null;
};

export type RemixSearchProvider = "SoundCloud" | "Spotify" | "Beatport";

export type RemixSearchCandidate = {
  title: string;
  artists: string;
  remixArtist?: string | null;
  album?: string | null;
  genre?: string | null;
  subGenre?: string | null;
  bpm?: number | null;
  provider: RemixSearchProvider;
  link: string;
  createdAt?: string | null;
  durationMs?: number | null;
  confidence: number;
  relevanceReason: string;
};

export type RemixSearchResponse = {
  originalTrack: RemixSearchOriginalTrack;
  requestedGenre?: string | null;
  candidates: RemixSearchCandidate[];
};
