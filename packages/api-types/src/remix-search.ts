export type RemixSearchRequest = {
  title?: string | null;
  artists?: string | null;
  spotifyUrl?: string | null;
  genre?: string | null;
};

export type RemixSearchOriginalTrack = {
  title: string;
  artists: string;
  spotifyUrl?: string | null;
  album?: string | null;
  durationMs?: number | null;
};

export type RemixSearchProvider = "SoundCloud" | "Spotify" | "Beatport";

export type RemixSearchCandidate = {
  title: string;
  artists: string;
  remixArtist?: string | null;
  album?: string | null;
  genre?: string | null;
  subGenre?: string | null;
  bpm?: number | null;
  provider: RemixSearchProvider;
  link: string;
  createdAt?: string | null;
  durationMs?: number | null;
  confidence: number;
  relevanceReason: string;
};

export type RemixSearchResponse = {
  originalTrack: RemixSearchOriginalTrack;
  requestedGenre?: string | null;
  candidates: RemixSearchCandidate[];
};

export type SavedRemixCandidate = RemixSearchCandidate & {
  id: number;
  originalTrack: RemixSearchOriginalTrack;
  requestedGenre?: string | null;
  savedAt: string;
  updatedAt: string;
};

export type SaveRemixCandidateRequest = {
  candidate: RemixSearchCandidate;
  originalTrack: RemixSearchOriginalTrack;
  requestedGenre?: string | null;
};

export type ListSavedRemixCandidatesResponse = {
  remixes: SavedRemixCandidate[];
};

export type SaveRemixCandidateResponse = {
  remix: SavedRemixCandidate;
};
