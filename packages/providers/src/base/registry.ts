import { createBeatportMetadataProvider } from "../beatport/beatport.provider.ts";
import { createGetSongBpmMetadataProvider } from "../getsongbpm/getsongbpm.provider.ts";
import { createSpotifyMetadataProvider } from "../spotify/spotify.provider.ts";
import type { TrackMetadataProvider } from "./types.ts";

export function createDefaultProviders(): TrackMetadataProvider[] {
  return [
    createSpotifyMetadataProvider(),
    createGetSongBpmMetadataProvider(),
    createBeatportMetadataProvider(),
  ];
}
