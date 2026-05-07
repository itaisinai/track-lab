export {
  lookupBeatportTrack,
  parseBeatportSearchHtml,
  type BeatportTrack,
} from "./beatport/metadata.ts";

export { lookupGetSongBpmTrack } from "./getsongbpm/metadata.ts";

export { lookupSpotifyTrack } from "./spotify/metadata.ts";

export {
  createSpotifyRemixSearchProvider,
  resolveSpotifyTrack,
  searchSpotifyRemixTracks,
  type SpotifyRemixProviderOptions,
  type SpotifyRemixSearchContext,
  type SpotifyRemixSearchLogger,
  type SpotifyRemixSearchProvider,
} from "./spotify/remix.ts";

export {
  createSoundCloudWebSearchProvider,
  searchSoundCloudWebTracks,
  soundCloudWebSearchInternals,
  type SoundCloudWebSearchContext,
  type SoundCloudWebSearchLogger,
  type SoundCloudWebSearchOptions,
  type SoundCloudWebSearchProvider,
  type SoundCloudWebSearchResult,
} from "./soundcloud/web-search.ts";

export {
  createSoundCloudRemixSearchProvider,
  searchSoundCloudRemixTracks,
  type SoundCloudRemixProviderOptions,
  type SoundCloudRemixSearchContext,
  type SoundCloudRemixSearchLogger,
  type SoundCloudRemixSearchProvider,
} from "./soundcloud/api-remix.ts";

export {
  lookupWikipediaContext,
  type WikipediaLookupResult,
} from "./wikipedia/context.ts";

export type {
  ProviderTrackLookupResult,
  TrackLookupInput,
} from "./shared/types.ts";
