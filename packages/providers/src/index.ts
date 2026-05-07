export {
  createDefaultProviders,
} from "./base/registry.ts";

export type {
  TrackMetadataProvider,
  TrackMetadataProviderInput,
  TrackMetadataProviderResult,
} from "./base/types.ts";

export {
  createBeatportMetadataProvider,
  lookupBeatportTrack,
  parseBeatportSearchHtml,
  type BeatportTrack,
} from "./beatport/beatport.provider.ts";

export {
  createGetSongBpmMetadataProvider,
  lookupGetSongBpmTrack,
} from "./getsongbpm/getsongbpm.provider.ts";

export {
  createSpotifyMetadataProvider,
  lookupSpotifyTrack,
} from "./spotify/spotify.provider.ts";

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
  createWikipediaContextProvider,
  lookupWikipediaContext,
  type WikipediaLookupResult,
} from "./wikipedia/wikipedia-context.provider.ts";

export type {
  ProviderTrackLookupResult,
  TrackLookupInput,
} from "./shared/types.ts";
