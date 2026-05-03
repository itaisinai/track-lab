export type View = "enrich" | "results";

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
  bpm?: string;
  genre?: string;
  subGenre?: string;
  key?: string;
  summary?: string;
  spotifyUrl?: string;
  toolsUsed?: ToolStatus[];
  errors?: ResultError[];
};

export type SavedTrackResult = {
  id: number;
  title: string;
  artists: string;
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
