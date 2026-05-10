import { createBeatportMetadataProvider } from "../beatport/beatport.provider.ts";
import { createGetSongBpmMetadataProvider } from "../getsongbpm/getsongbpm.provider.ts";
import { createSoundCloudMetadataProvider } from "../soundcloud/soundcloud.provider.ts";
import { createSpotifyMetadataProvider } from "../spotify/spotify.provider.ts";
import type { TrackMetadataProvider } from "./types.ts";

export function createDefaultProviders(): TrackMetadataProvider[] {
  return [
    ...createRequiredMetadataProviders(),
    ...createBpmMetadataProviders(),
    ...createEdmCatalogMetadataProviders(),
  ];
}

export function createRequiredMetadataProviders(): TrackMetadataProvider[] {
  return [
    createSpotifyMetadataProvider(),
  ];
}

export function createBpmMetadataProviders(): TrackMetadataProvider[] {
  return [
    createGetSongBpmMetadataProvider(),
  ];
}

export function createEdmCatalogMetadataProviders(): TrackMetadataProvider[] {
  return [
    createBeatportMetadataProvider(),
    createSoundCloudMetadataProvider(),
  ];
}
