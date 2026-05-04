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
        rawResponse: JSON.stringify(toAgentResult(result, input)),
        json: toAgentResult(result, input),
      });
    },
  };
}

function toAgentResult(
  result: EnrichedTrackMetadata,
  input: EnrichTrackMetadataInput,
) {
  const spotifyTool = findTool(result, "Spotify");
  const getSongBpmTool = findTool(result, "GetSongBPM");

  return {
    Title: result.trackName,
    Artists: result.artist ?? input.artist,
    Album: result.album ?? null,
    BPM: result.bpm,
    Genre: result.genre,
    SubGenre: null,
    Key: result.key ?? null,
    AI_generated_summary: result.summary ?? "",
    Spotify: {
      matched:
        spotifyTool?.matched ??
        (result.sources.genre === "spotify" ||
          result.sources.album === "spotify" ||
          Boolean(result.spotifyUrl)),
      url: result.spotifyUrl ?? spotifyTool?.url ?? null,
      error: spotifyTool?.error ?? null,
    },
    Beatport: {
      matched: false,
      url: null,
      error: null,
    },
    GetSongBPM: {
      matched:
        getSongBpmTool?.matched ??
        (result.sources.bpm === "getsongbpm" ||
          result.sources.genre === "getsongbpm" ||
          result.sources.album === "getsongbpm"),
      url: getSongBpmTool?.url ?? null,
      error: getSongBpmTool?.error ?? null,
    },
  };
}

function findTool(result: EnrichedTrackMetadata, name: string) {
  return result.toolsUsed?.find((tool) => tool.name === name);
}
