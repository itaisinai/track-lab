import { createSoundCloudRemixSearchProvider } from "@track-lab/providers";
import { logRemixProvider } from "@track-lab/logger";
import { extractRemixArtist } from "../scoring.ts";
import type { RemixSearchContext, RemixSearchProviderModule } from "../types.ts";

export const soundCloudRemixProvider: RemixSearchProviderModule = {
  name: "SoundCloud",
  search(context: RemixSearchContext) {
    return createSoundCloudRemixSearchProvider({
      extractRemixArtist,
      logger(message, details) {
        logRemixProvider("soundcloud", message, details);
      },
    }).search({
      queries: context.queries,
      genre: context.request.genre,
    });
  },
};
