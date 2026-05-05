export type ResultStatus = "complete" | "partial" | "failed";

export type ToolStatus = {
  name: string;
  matched: boolean | null;
  url: string | null;
  error: string | null;
};

export type ResultError = {
  source: string;
  message: string;
};

export type TrackResult = {
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
  toolsUsed: ToolStatus[];
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

export type NormalizedTrackResult = {
  title: string;
  artists: string;
  album: string | null;
  bpm: number | null;
  genre: string | null;
  subGenre: string | null;
  key: string | null;
  summary: string | null;
  status: ResultStatus;
  toolsUsed: ToolStatus[];
  errors: ResultError[];
};

export type TrackResultRow = {
  id: number;
  title: string;
  artists: string;
  album: string | null;
  bpm: number | null;
  genre: string | null;
  sub_genre: string | null;
  track_key: string | null;
  summary: string | null;
  status: ResultStatus;
  tools_used_json: string;
  errors_json: string;
  response_json: string;
  raw_response: string;
  created_at: string;
  updated_at: string;
};

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

export type EnqueueTrackAnalysisJobInput = {
  operation: TrackAnalysisOperation;
  payload: TrackAnalysisPayload;
  maxAttempts?: number;
};

export type TrackAnalysisJob = {
  id: number;
  operation: TrackAnalysisOperation;
  status: TrackAnalysisJobStatus;
  payload: unknown;
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

export type TrackAnalysisJobRow = {
  id: number;
  operation: TrackAnalysisOperation;
  status: TrackAnalysisJobStatus;
  payload_json: string;
  result_json: string | null;
  error_message: string | null;
  attempt_count: number;
  max_attempts: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  notification_read_at: string | null;
  resolved_at: string | null;
};
