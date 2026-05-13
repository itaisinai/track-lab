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
  providersUsed?: ProviderStatus[];
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
  providersUsed: ProviderStatus[];
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

export type ListSavedResultsResponse = {
  results: SavedTrackResult[];
};

export type SaveTrackResultResponse = {
  result: SavedTrackResult;
};
