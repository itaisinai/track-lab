export type EnrichTrackMetadataInput = {
  operation?: "analyze" | "enrich";
  trackName: string;
  artist?: string;
  knownMetadata?: Partial<{
    album: string | null;
    bpm: number | null;
    genre: string | null;
    subGenre: string | null;
    key: string | null;
    spotifyUrl: string | null;
  }>;
};

export type EnrichmentSource =
  | "local_db"
  | "spotify"
  | "getsongbpm"
  | "lastfm"
  | "unknown";

export type EnrichedTrackMetadata = {
  operation?: "analyze" | "enrich";
  trackName: string;
  artist?: string;
  album?: string | null;
  spotifyUrl?: string | null;
  summary?: string | null;
  bpm: number | null;
  genre: string | null;
  subGenre?: string | null;
  key?: string | null;
  sources: {
    bpm?: EnrichmentSource;
    genre?: EnrichmentSource;
    album?: Extract<
      EnrichmentSource,
      "local_db" | "spotify" | "getsongbpm" | "unknown"
    >;
    key?: Extract<EnrichmentSource, "local_db" | "unknown">;
  };
  confidence: {
    bpm?: number;
    genre?: number;
    album?: number;
    key?: number;
  };
  toolsUsed?: Array<{
    name: string;
    matched: boolean | null;
    url: string | null;
    error: string | null;
  }>;
  changedFields?: Array<"album" | "bpm" | "genre" | "subGenre" | "key" | "spotifyUrl">;
  reviewNotes?: string[];
  conflicts?: string[];
  status: "complete" | "partial" | "missing";
  errors?: string[];
};
