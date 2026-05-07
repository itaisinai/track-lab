export type TrackLookupInput = {
  title: string;
  artists: string;
};

export type ProviderTrackLookupResult = {
  found: boolean;
  source: string;
  bpm: number | null;
  genre: string | null;
  genres?: string[];
  subGenre?: string | null;
  key?: string | null;
  url: string | null;
  track?: unknown;
  candidates?: unknown[];
  error?: string | null;
  note?: string;
};
