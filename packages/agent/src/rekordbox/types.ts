export type RekordboxTrackMetadata = {
  trackName: string;
  artist?: string;
  bpm: number | null;
  genre: string | null;
  key?: string | null;
  location?: string | null;
};
