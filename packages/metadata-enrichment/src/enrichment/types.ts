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
  | "beatport"
  | "getsongbpm"
  | "soundcloud"
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
    trackName?: Extract<EnrichmentSource, "local_db" | "spotify" | "beatport" | "soundcloud" | "getsongbpm" | "unknown">;
    artist?: Extract<EnrichmentSource, "local_db" | "spotify" | "beatport" | "soundcloud" | "getsongbpm" | "unknown">;
    bpm?: EnrichmentSource;
    genre?: EnrichmentSource;
    subGenre?: EnrichmentSource;
    album?: Extract<
      EnrichmentSource,
      "local_db" | "spotify" | "beatport" | "getsongbpm" | "unknown"
    >;
    key?: Extract<EnrichmentSource, "local_db" | "beatport" | "getsongbpm" | "unknown">;
  };
  confidence: {
    bpm?: number;
    genre?: number;
    subGenre?: number;
    album?: number;
    key?: number;
  };
  providersUsed?: Array<{
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
