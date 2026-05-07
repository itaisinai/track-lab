import {
  createSpotifyRemixSearchProvider,
  resolveSpotifyTrack as resolveSpotifyProviderTrack,
} from "@track-lab/providers";
import { logRemixProvider } from "@track-lab/logger";
import { extractRemixArtist } from "../scoring.ts";
import type { RemixSearchContext, RemixSearchProviderModule } from "../types.ts";

export const spotifyRemixProvider: RemixSearchProviderModule = {
  name: "Spotify",
  search(context: RemixSearchContext) {
    return createSpotifyRemixSearchProvider({
      extractRemixArtist,
      logger(message, details) {
        logRemixProvider("spotify", message, details);
      },
    }).search({
      queries: context.queries,
    });
  },
};

export function resolveSpotifyTrack(spotifyUrl: string | null | undefined) {
  return resolveSpotifyProviderTrack(spotifyUrl, {
    logger(message, details) {
      logRemixProvider("spotify", message, details);
    },
  });
}
