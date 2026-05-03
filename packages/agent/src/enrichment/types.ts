export type EnrichTrackMetadataInput = {
  trackName: string;
  artist?: string;
  rekordboxXmlPath?: string;
  filePath?: string;
};

export type EnrichmentSource =
  | "local_db"
  | "rekordbox_xml"
  | "audio_analysis"
  | "spotify"
  | "getsongbpm"
  | "lastfm"
  | "unknown";

export type EnrichedTrackMetadata = {
  trackName: string;
  artist?: string;
  album?: string | null;
  spotifyUrl?: string | null;
  bpm: number | null;
  genre: string | null;
  key?: string | null;
  sources: {
    bpm?: EnrichmentSource;
    genre?: EnrichmentSource;
    album?: Extract<
      EnrichmentSource,
      "local_db" | "spotify" | "getsongbpm" | "unknown"
    >;
    key?: Extract<EnrichmentSource, "local_db" | "rekordbox_xml" | "unknown">;
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
  status: "complete" | "partial" | "missing";
  errors?: string[];
};
