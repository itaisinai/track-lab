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
