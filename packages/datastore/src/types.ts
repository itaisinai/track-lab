import type {
  NormalizedTrackResult,
  ProviderStatus,
  ResultError,
  ResultStatus,
  SaveTrackResultInput,
  SavedTrackResult,
  TrackAnalysisJob,
  TrackAnalysisJobStatus,
  TrackAnalysisKnownMetadata,
  TrackAnalysisOperation,
  TrackAnalysisPayload,
  TrackAnalysisSource,
} from "@track-lab/api-types";

export type {
  NormalizedTrackResult,
  ProviderStatus,
  ResultError,
  ResultStatus,
  SaveTrackResultInput,
  SavedTrackResult,
  TrackAnalysisJob,
  TrackAnalysisJobStatus,
  TrackAnalysisKnownMetadata,
  TrackAnalysisOperation,
  TrackAnalysisPayload,
  TrackAnalysisSource,
};

export type ToolStatus = ProviderStatus;
export type TrackResult = SavedTrackResult;

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

export type EnqueueTrackAnalysisJobInput = {
  operation: TrackAnalysisOperation;
  payload: TrackAnalysisPayload;
  maxAttempts?: number;
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
