import { createSoundCloudWebSearchProvider } from "@track-lab/providers";
import { logRemixProvider } from "@track-lab/logger";
import { extractRemixArtist } from "../scoring.ts";
import type { RemixSearchContext, RemixSearchProviderModule } from "../types.ts";

export const soundCloudWebSearchProvider: RemixSearchProviderModule = {
  name: "SoundCloud",
  search(context: RemixSearchContext) {
    return createSoundCloudWebSearchProvider({
      extractRemixArtist,
      logger(message, details) {
        logRemixProvider("soundcloud-web", message, details);
      },
    }).search({
      queries: context.queries,
      genre: context.request.genre,
    });
  },
};

export { soundCloudWebSearchInternals } from "@track-lab/providers";
