import { lookupGetSongBpmTrack } from "../providers/getsongbpm.ts";
import { lookupSpotifyTrack } from "../providers/spotify.ts";
import { loadRekordboxTracks } from "../rekordbox/rekordbox-xml-parser.ts";
import { findRekordboxTrack } from "../rekordbox/rekordbox-track-lookup.ts";
import { getEnrichmentStatus } from "./enrichment-status.ts";
import type { EnrichmentResultStore } from "./enrichment-result-store.ts";
import type {
  EnrichedTrackMetadata,
  EnrichTrackMetadataInput,
  EnrichmentSource,
} from "./types.ts";

export type ProviderLookup = (input: {
  title: string;
  artists: string;
}) => Promise<{
  found?: boolean;
  source?: string;
  bpm: number | null;
  genre: string | null;
  key?: string | null;
  album?: string | null;
  url?: string | null;
  track?: unknown;
  error?: string | null;
}>;

export type EnrichmentDependencies = {
  store?: EnrichmentResultStore;
  spotifyLookup?: ProviderLookup;
  getSongBpmLookup?: ProviderLookup;
  loadRekordboxTracks?: typeof loadRekordboxTracks;
};

export async function enrichTrackMetadata(
  input: EnrichTrackMetadataInput,
  dependencies: EnrichmentDependencies = {},
): Promise<EnrichedTrackMetadata> {
  const errors: string[] = [];
  const result: EnrichedTrackMetadata = {
    trackName: input.trackName,
    artist: input.artist,
    bpm: null,
    genre: null,
    key: null,
    sources: {},
    confidence: {},
    toolsUsed: [],
    status: "missing",
  };

  applyLocalResult(result, dependencies.store?.findByTrack(input.trackName, input.artist));

  if (isMissingBpmOrGenre(result) && input.rekordboxXmlPath) {
    try {
      const tracks = await (dependencies.loadRekordboxTracks ?? loadRekordboxTracks)(
        input.rekordboxXmlPath,
      );
      const rekordboxTrack = findRekordboxTrack(
        tracks,
        input.trackName,
        input.artist,
      );

      if (rekordboxTrack) {
        result.trackName = rekordboxTrack.trackName;
        result.artist = rekordboxTrack.artist ?? result.artist;
        applyValue(result, "bpm", rekordboxTrack.bpm, "rekordbox_xml", 0.95);
        applyValue(result, "genre", rekordboxTrack.genre, "rekordbox_xml", 0.95);
        applyValue(result, "key", rekordboxTrack.key ?? null, "rekordbox_xml", 0.95);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (!result.bpm && input.filePath) {
    result.sources.bpm = "audio_analysis";
    result.confidence.bpm = 0;
  }

  if (isMissingBpmOrGenre(result) && input.artist) {
    await applyProviderFallbacks(result, input, dependencies, errors);
  }

  result.sources.bpm ??= "unknown";
  result.sources.genre ??= "unknown";
  result.sources.album ??= result.album ? "unknown" : undefined;
  result.sources.key ??= result.key ? "unknown" : undefined;
  result.status = getEnrichmentStatus(result.bpm, result.genre);

  if (errors.length > 0) {
    result.errors = errors;
  }

  dependencies.store?.saveEnrichedResult?.(result, input);

  return result;
}

function applyLocalResult(
  result: EnrichedTrackMetadata,
  localResult:
    | {
        title: string;
        artists: string;
        album: string | null;
        bpm: number | null;
        genre: string | null;
        key: string | null;
      }
    | null
    | undefined,
) {
  if (!localResult) {
    return;
  }

  result.trackName = localResult.title;
  result.artist = localResult.artists;
  applyAlbum(result, localResult.album, "local_db", 1);
  applyValue(result, "bpm", localResult.bpm, "local_db", 1);
  applyValue(result, "genre", localResult.genre, "local_db", 1);
  applyValue(result, "key", localResult.key, "local_db", 1);
}

async function applyProviderFallbacks(
  result: EnrichedTrackMetadata,
  input: EnrichTrackMetadataInput,
  dependencies: EnrichmentDependencies,
  errors: string[],
) {
  const providerInput = {
    title: result.trackName,
    artists: result.artist ?? (input.artist as string),
  };

  if (!result.genre) {
    const spotify = await safeLookup(
      dependencies.spotifyLookup ?? lookupSpotifyTrack,
      providerInput,
      errors,
    );
    addToolStatus(result, "Spotify", spotify);
    applyProviderIdentity(result, spotify?.track);
    applyAlbum(result, getProviderAlbum(spotify), "spotify", 0.85);
    result.spotifyUrl ??= getProviderUrl(spotify);
    applyValue(result, "genre", spotify?.genre ?? null, "spotify", 0.65);
  }

  if (!result.bpm || !result.genre) {
    const getSongBpm = await safeLookup(
      dependencies.getSongBpmLookup ?? lookupGetSongBpmTrack,
      providerInput,
      errors,
    );
    addToolStatus(result, "GetSongBPM", getSongBpm);
    applyProviderIdentity(result, getSongBpm?.track);
    applyAlbum(result, getProviderAlbum(getSongBpm), "getsongbpm", 0.65);
    applyValue(result, "bpm", getSongBpm?.bpm ?? null, "getsongbpm", 0.7);
    applyValue(result, "genre", getSongBpm?.genre ?? null, "getsongbpm", 0.55);

    if (!result.key) {
      applyValue(result, "key", getSongBpm?.key ?? null, "unknown", 0.4);
    }
  }
}

function addToolStatus(
  result: EnrichedTrackMetadata,
  name: string,
  lookupResult:
    | {
        found?: boolean;
        bpm: number | null;
        genre: string | null;
        album?: string | null;
        url?: string | null;
        track?: unknown;
        error?: string | null;
      }
    | null,
) {
  result.toolsUsed ??= [];
  result.toolsUsed.push({
    name,
    matched: lookupResult ? isProviderMatched(lookupResult) : false,
    url: lookupResult?.url ?? getTrackSpotifyUrl(lookupResult?.track),
    error: lookupResult?.error ?? null,
  });
}

function isProviderMatched(lookupResult: {
  found?: boolean;
  bpm: number | null;
  genre: string | null;
  album?: string | null;
  url?: string | null;
  track?: unknown;
}) {
  return Boolean(
    lookupResult.found ||
      lookupResult.bpm ||
      lookupResult.genre ||
      lookupResult.album ||
      lookupResult.url ||
      lookupResult.track,
  );
}

async function safeLookup(
  lookup: ProviderLookup,
  input: { title: string; artists: string },
  errors: string[],
) {
  try {
    const result = await lookup(input);

    if (result.error) {
      errors.push(result.error);
    }

    return result;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return null;
  }
}

function applyValue(
  result: EnrichedTrackMetadata,
  field: "bpm" | "genre" | "key",
  value: number | string | null | undefined,
  source: EnrichmentSource,
  confidence: number,
) {
  if (value === null || value === undefined || value === "") {
    return;
  }

  if (result[field]) {
    return;
  }

  if (field === "bpm") {
    result.bpm = typeof value === "number" ? value : Number(value);
    result.sources.bpm = source;
    result.confidence.bpm = confidence;
    return;
  }

  result[field] = String(value);
  result.sources[field] = source as never;
  result.confidence[field] = confidence;
}

function isMissingBpmOrGenre(result: EnrichedTrackMetadata) {
  return !result.bpm || !result.genre;
}

function applyProviderIdentity(
  result: EnrichedTrackMetadata,
  track: unknown,
) {
  if (!track || typeof track !== "object") {
    return;
  }

  const record = track as Record<string, unknown>;
  const title = getStringValue(record.title);
  const artists =
    getStringListValue(record.artists) ?? getStringValue(record.artist);

  result.trackName = title ?? result.trackName;
  result.artist = artists ?? result.artist;
}

function getProviderAlbum(
  providerResult: { album?: string | null; track?: unknown } | null | undefined,
) {
  return providerResult?.album ?? getTrackAlbum(providerResult?.track);
}

function getTrackAlbum(track: unknown) {
  if (!track || typeof track !== "object") {
    return null;
  }

  return getStringValue((track as Record<string, unknown>).album);
}

function getProviderUrl(providerResult: { url?: string | null; track?: unknown } | null | undefined) {
  return providerResult?.url ?? getTrackSpotifyUrl(providerResult?.track);
}

function getTrackSpotifyUrl(track: unknown) {
  if (!track || typeof track !== "object") {
    return null;
  }

  const record = track as Record<string, unknown>;
  return getStringValue(record.spotifyUrl) ?? getStringValue(record.url);
}

function applyAlbum(
  result: EnrichedTrackMetadata,
  album: string | null | undefined,
  source: Extract<EnrichmentSource, "local_db" | "spotify" | "getsongbpm">,
  confidence: number,
) {
  if (!album || result.album) {
    return;
  }

  result.album = album;
  result.sources.album = source;
  result.confidence.album = confidence;
}

function getStringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getStringListValue(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const values = value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );

  return values.length > 0 ? values.join(", ") : null;
}
