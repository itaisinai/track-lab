export type View = "enrich" | "results" | "review" | "datastore";

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
  toolsUsed?: ToolStatus[];
  changedFields?: Array<"album" | "bpm" | "genre" | "subGenre" | "key" | "spotifyUrl">;
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
  status: "complete" | "partial" | "failed";
  toolsUsed: ToolStatus[];
  errors: ResultError[];
  json: unknown;
  rawResponse: string;
  createdAt: string;
  updatedAt: string;
};

export type TrackAnalysisJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "dead_lettered";

export type TrackAnalysisJob = {
  id: number;
  operation: "analyze" | "enrich";
  status: TrackAnalysisJobStatus;
  payload: {
    operation: "analyze" | "enrich";
    track: {
      title: string;
      artists: string;
    };
    knownMetadata?: Partial<{
      album: string | null;
      bpm: number | null;
      genre: string | null;
      subGenre: string | null;
      key: string | null;
      spotifyUrl: string | null;
    }>;
    source?: "manual" | "saved_result" | "bulk_saved_results";
  };
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
