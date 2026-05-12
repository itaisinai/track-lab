import type {
  ProviderTrackLookupResult,
  TrackLookupInput,
} from "../shared/types.ts";
import type {
  TrackMetadataProvider,
  TrackMetadataProviderInput,
  TrackMetadataProviderResult,
} from "../base/types.ts";
import {
  getTrackArtists,
  getTrackString,
  hasUsefulTrackLookupResult,
} from "../shared/provider-result-utils.ts";
import { logProviderSearch, parseNumericValue } from "../shared/utils.ts";
import { normalizeTrackLookupInput } from "../shared/track-query.ts";
import { normalizeProviderGenre } from "../shared/genre-normalization.ts";
import {
  findBestBeatportMatch,
  getArtistNames,
  getBeatportLabel,
  getBeatportGenre,
  getBeatportUrl,
  getName,
  getTrackName,
  parseBeatportSearchHtml,
  searchCratesBeatportTracks,
  toBeatportSummary,
  type BeatportTrack,
} from "./metadata-utils.ts";

export function createBeatportMetadataProvider(): TrackMetadataProvider {
  return {
    name: "Beatport",
    lookup(input: TrackMetadataProviderInput) {
      return lookupTrackMetadata(input);
    },
  };
}

async function lookupTrackMetadata({
  trackName,
  artist,
}: TrackMetadataProviderInput): Promise<TrackMetadataProviderResult | null> {
  if (!artist) {
    return null;
  }

  const result = await lookupBeatportTrack({ title: trackName, artists: artist });

  if (!hasUsefulTrackLookupResult(result)) {
    return null;
  }

  return {
    bpm: result.bpm,
    genre: result.genre,
    key: result.key,
    subGenre: result.subGenre,
    album: getTrackString(result.track, "release"),
    url: result.url,
    matchedTrack: {
      title: getTrackString(result.track, "title"),
      artists: getTrackArtists(result.track),
    },
    source: "beatport",
    confidence: 0.85,
    raw: result,
  };
}

export async function lookupBeatportTrack({
  title,
  artists,
}: TrackLookupInput): Promise<ProviderTrackLookupResult> {
  const input = normalizeTrackLookupInput(title, artists);
  logProviderSearch("beatport", "search started", {
    title: input.title,
    artists: input.artists,
  });

  try {
    const { match, tracks, source } = await searchCratesBeatport(input.title, input.artists);

    logProviderSearch("beatport", `${source} search results`, {
      candidates: tracks.length,
      selected: match ? getTrackName(match) : null,
    });

    if (!match) {
      logProviderSearch("beatport", "no match", {
        title: input.title,
        artists: input.artists,
      });
      return {
        found: false,
        source: "beatport",
        bpm: null,
        genre: null,
        key: null,
        url: null,
        error: null,
        note: "No matching Beatport track found.",
        candidates: tracks.slice(0, 5).map(toBeatportSummary),
      };
    }

    logProviderSearch(
      "beatport",
      "matched crates track",
      toBeatportSummary(match),
    );

    return toLookupResult(match, tracks);
  } catch (error) {
    logProviderSearch("beatport", "search failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      found: false,
      source: "beatport",
      bpm: null,
      genre: null,
      key: null,
      url: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export { parseBeatportSearchHtml, type BeatportTrack };

async function searchCratesBeatport(title: string, artists: string) {
  logProviderSearch("beatport", "using crates search proxy");
  const tracks = await searchCratesBeatportTracks(title, artists);
  return {
    source: "crates",
    tracks,
    match: findBestBeatportMatch(tracks, title, artists) ?? null,
  };
}

function toLookupResult(
  match: BeatportTrack,
  tracks: BeatportTrack[],
): ProviderTrackLookupResult {
  const genre = normalizeProviderGenre({
    source: "beatport",
    genre: getBeatportGenre(match, 0),
    subGenre: getName(match.sub_genre) ?? match.sub_genre_name ?? getBeatportGenre(match, 1),
  });

  return {
    found: true,
    source: "beatport",
    bpm: parseNumericValue(match.bpm),
    genre: genre.genre,
    subGenre: genre.subGenre,
    key: match.key_name ?? getName(match.key) ?? null,
    url: getBeatportUrl(match),
    track: {
      id: match.id ?? match.track_id,
      title: getTrackName(match),
      mixName: match.mix_name ?? null,
      artists: getArtistNames(match),
      release: getName(match.release) ?? match.release_name ?? null,
      label: getBeatportLabel(match),
    },
    error: null,
    originalGenre: genre.originalGenre,
    candidates: tracks.slice(0, 5).map(toBeatportSummary),
  };
}
