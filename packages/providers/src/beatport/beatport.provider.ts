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
import {
  findBestBeatportMatch,
  getArtistNames,
  getBeatportAccessToken,
  getBeatportGenre,
  getBeatportUrl,
  getName,
  getTrackName,
  hasBeatportCredentials,
  parseBeatportSearchHtml,
  searchBeatportPublicTracks,
  searchBeatportTracks,
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
  logProviderSearch("beatport", "search started", { title, artists });

  try {
    const { match, tracks, source } = hasBeatportCredentials()
      ? await searchAuthenticatedBeatport(title, artists)
      : await searchPublicBeatport(title, artists);

    logProviderSearch("beatport", `${source} search results`, {
      candidates: tracks.length,
      selected: match ? getTrackName(match) : null,
    });

    if (!match) {
      logProviderSearch("beatport", "no match", { title, artists });
      return {
        found: false,
        source: "beatport",
        bpm: null,
        genre: null,
        key: null,
        url: null,
        error: null,
        note: "No matching Beatport track found.",
        candidates: source === "public" ? [] : tracks.slice(0, 5).map(toBeatportSummary),
      };
    }

    logProviderSearch(
      "beatport",
      source === "public" ? "matched public track" : "matched track",
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

async function searchAuthenticatedBeatport(title: string, artists: string) {
  const token = await getBeatportAccessToken();
  const tracks = await searchBeatportTracks(token, title, artists);
  return {
    source: "api",
    tracks,
    match: findBestBeatportMatch(tracks, title, artists) ?? tracks[0] ?? null,
  };
}

async function searchPublicBeatport(title: string, artists: string) {
  logProviderSearch("beatport", "using public search page fallback");
  const tracks = await searchBeatportPublicTracks(title, artists);
  return {
    source: "public",
    tracks,
    match: findBestBeatportMatch(tracks, title, artists) ?? null,
  };
}

function toLookupResult(
  match: BeatportTrack,
  tracks: BeatportTrack[],
): ProviderTrackLookupResult {
  return {
    found: true,
    source: "beatport",
    bpm: parseNumericValue(match.bpm),
    genre: getBeatportGenre(match, 0),
    subGenre: getName(match.sub_genre) ?? match.sub_genre_name ?? getBeatportGenre(match, 1),
    key: match.key_name ?? getName(match.key) ?? null,
    url: getBeatportUrl(match),
    track: {
      id: match.id ?? match.track_id,
      title: getTrackName(match),
      mixName: match.mix_name ?? null,
      artists: getArtistNames(match),
      release: getName(match.release) ?? match.release_name ?? null,
      label: getName(match.label) ?? match.label_name ?? null,
    },
    error: null,
    candidates: tracks.slice(0, 5).map(toBeatportSummary),
  };
}
