export type TrackMetadataProviderInput = {
  trackName: string;
  artist?: string;
};

export type TrackMetadataProviderResult = {
  bpm?: number | null;
  genre?: string | null;
  key?: string | null;
  tags?: string[];
  album?: string | null;
  subGenre?: string | null;
  url?: string | null;
  matchedTrack?: {
    title?: string | null;
    artists?: string | null;
  };
  source: string;
  confidence: number;
  raw?: unknown;
};

export interface TrackMetadataProvider {
  name: string;

  lookup(
    input: TrackMetadataProviderInput,
  ): Promise<TrackMetadataProviderResult | null>;
}
