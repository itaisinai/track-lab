import type {
  RemixSearchCandidate,
  RemixSearchOriginalTrack,
  RemixSearchRequest,
} from "@track-lab/api-types";

export type NormalizedRemixSearchRequest = {
  title: string;
  artists: string;
  spotifyUrl: string | null;
  genre: string | null;
};

export type RemixSearchContext = {
  request: NormalizedRemixSearchRequest;
  originalTrack: RemixSearchOriginalTrack;
  queries: string[];
};

export type RemixSearchProviderModule = {
  name: string;
  search(context: RemixSearchContext): Promise<RemixSearchCandidate[]>;
};

export type RemixSearchInput = RemixSearchRequest;
