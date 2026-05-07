import type {
  ProviderTrackLookupResult,
  TrackLookupInput,
} from "../shared/types.ts";
import { logProviderSearch, parseNumericValue } from "../shared/utils.ts";
import {
  firstGetSongBpmArtist,
  getSongBpmApiKey,
  searchGetSongBpmTrack,
  toGetSongBpmTrackSummary,
} from "./metadata-utils.ts";

export async function lookupGetSongBpmTrack({
  title,
  artists,
}: TrackLookupInput): Promise<ProviderTrackLookupResult> {
  logProviderSearch("getsongbpm", "search started", { title, artists });
  const apiKey = getSongBpmApiKey();

  if (!apiKey) {
    logProviderSearch("getsongbpm", "skipped missing api key");
    return {
      found: false,
      source: "getsongbpm",
      bpm: null,
      genre: null,
      genres: [],
      url: null,
      error: "Missing GETSONGBPM_API_KEY environment variable.",
    };
  }

  try {
    const lookup = `song:${title} artist:${artists}`;
    logProviderSearch("getsongbpm", "requesting search", { lookup });
    const { tracks, match } = await searchGetSongBpmTrack(
      apiKey,
      title,
      artists,
    );
    logProviderSearch("getsongbpm", "search results", {
      candidates: tracks.length,
      selected: match?.title ?? null,
    });

    if (!match) {
      logProviderSearch("getsongbpm", "no match", { title, artists });
      return {
        found: false,
        source: "getsongbpm",
        bpm: null,
        genre: null,
        genres: [],
        url: null,
        error: null,
        note: "No matching GetSongBPM track found.",
        candidates: tracks.slice(0, 5).map(toGetSongBpmTrackSummary),
      };
    }

    const artist = firstGetSongBpmArtist(match.artist);
    logProviderSearch("getsongbpm", "matched track", {
      title: match.title,
      artist: artist?.name ?? null,
      bpm: parseNumericValue(match.tempo),
      key: match.key_of ?? null,
      url: match.uri ?? null,
    });

    return {
      found: true,
      source: "getsongbpm",
      bpm: parseNumericValue(match.tempo),
      genre: artist?.genres?.[0] ?? null,
      genres: artist?.genres ?? [],
      key: match.key_of ?? null,
      url: match.uri ?? null,
      error: null,
      track: {
        id: match.id,
        title: match.title,
        uri: match.uri ?? null,
        artist: artist?.name ?? null,
        album: match.album?.title ?? null,
        albumYear: match.album?.year ?? null,
        timeSignature: match.time_sig ?? null,
        key: match.key_of ?? null,
        openKey: match.open_key ?? null,
        danceability: match.danceability ?? null,
        acousticness: match.acousticness ?? null,
      },
      candidates: tracks.slice(0, 5).map(toGetSongBpmTrackSummary),
    };
  } catch (error) {
    logProviderSearch("getsongbpm", "search failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      found: false,
      source: "getsongbpm",
      bpm: null,
      genre: null,
      genres: [],
      url: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
