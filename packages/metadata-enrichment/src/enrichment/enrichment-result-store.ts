import type { TrackResult, TrackResultStore } from "@track-lab/datastore";
import type { EnrichedTrackMetadata, EnrichTrackMetadataInput } from "./types.ts";

export type EnrichmentResultStore = {
  findByTrack: (trackName: string, artist?: string) => TrackResult | null;
  saveEnrichedResult?: (
    result: EnrichedTrackMetadata,
    input: EnrichTrackMetadataInput,
  ) => void;
};

export function createDatastoreEnrichmentStore(
  store: TrackResultStore,
): EnrichmentResultStore {
  return {
    findByTrack(trackName, artist) {
      if (!artist) {
        return null;
      }

      return store.findByTrack(trackName, artist);
    },
    saveEnrichedResult(result, input) {
      if (!input.artist) {
        return;
      }

      store.saveResult({
        rawResponse: JSON.stringify(toEnrichmentResult(result, input)),
        json: toEnrichmentResult(result, input),
      });
    },
  };
}

function toEnrichmentResult(
  result: EnrichedTrackMetadata,
  input: EnrichTrackMetadataInput,
) {
  const spotifyProviderStatus = findProviderStatus(result, "Spotify");
  const getSongBpmProviderStatus = findProviderStatus(result, "GetSongBPM");

  return {
    Title: result.trackName,
    Artists: result.artist ?? input.artist,
    Album: result.album ?? null,
    BPM: result.bpm,
    Genre: result.genre,
    SubGenre: result.subGenre ?? null,
    Key: result.key ?? null,
    AI_generated_summary: result.summary ?? "",
    Spotify: {
      matched:
        spotifyProviderStatus?.matched ??
        (result.sources.genre === "spotify" ||
          result.sources.album === "spotify" ||
          Boolean(result.spotifyUrl)),
      url: result.spotifyUrl ?? spotifyProviderStatus?.url ?? null,
      error: spotifyProviderStatus?.error ?? null,
    },
    Beatport: {
      matched: false,
      url: null,
      error: null,
    },
    GetSongBPM: {
      matched:
        getSongBpmProviderStatus?.matched ??
        (result.sources.bpm === "getsongbpm" ||
          result.sources.genre === "getsongbpm" ||
          result.sources.album === "getsongbpm"),
      url: getSongBpmProviderStatus?.url ?? null,
      error: getSongBpmProviderStatus?.error ?? null,
    },
  };
}

function findProviderStatus(result: EnrichedTrackMetadata, name: string) {
  return result.providersUsed?.find((provider) => provider.name === name);
}
