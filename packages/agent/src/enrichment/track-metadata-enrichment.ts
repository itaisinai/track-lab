import { lookupGetSongBpmTrack } from "../providers/getsongbpm.ts";
import { lookupSpotifyTrack } from "../providers/spotify.ts";
import {
  lookupWikipediaContext,
  type WikipediaLookupResult,
} from "../providers/wikipedia.ts";
import { getEnrichmentStatus } from "./enrichment-status.ts";
import type { EnrichmentResultStore } from "./enrichment-result-store.ts";
import {
  synthesizeEnrichedTrackMetadata,
  type ProviderEvidence,
} from "./llm-synthesis.ts";
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

export type WikipediaLookup = (input: {
  title: string;
  artists: string;
}) => Promise<WikipediaLookupResult>;

export type EnrichmentDependencies = {
  store?: EnrichmentResultStore;
  spotifyLookup?: ProviderLookup;
  getSongBpmLookup?: ProviderLookup;
  wikipediaLookup?: WikipediaLookup;
  synthesize?: typeof synthesizeEnrichedTrackMetadata;
};

export async function enrichTrackMetadata(
  input: EnrichTrackMetadataInput,
  dependencies: EnrichmentDependencies = {},
): Promise<EnrichedTrackMetadata> {
  const errors: string[] = [];
  const result: EnrichedTrackMetadata = {
    operation: input.operation ?? "analyze",
    trackName: input.trackName,
    artist: input.artist,
    album: input.knownMetadata?.album ?? undefined,
    spotifyUrl: input.knownMetadata?.spotifyUrl ?? undefined,
    summary: null,
    bpm: null,
    genre: null,
    subGenre: input.knownMetadata?.subGenre ?? null,
    key: input.knownMetadata?.key ?? null,
    sources: {},
    confidence: {},
    toolsUsed: [],
    status: "missing",
  };
  applyKnownMetadata(result, input);

  if (result.operation === "analyze") {
    applyLocalResult(result, dependencies.store?.findByTrack(input.trackName, input.artist));
  }

  const providerEvidence: ProviderEvidence = {};
  if (shouldCallProviders(result, input)) {
    Object.assign(
      providerEvidence,
      await applyProviderFallbacks(result, input, dependencies, errors),
    );
  }

  if (shouldCallContextProviders(result, input)) {
    Object.assign(
      providerEvidence,
      await applyContextProviders(result, input, dependencies, errors),
    );
  }

  result.sources.bpm ??= "unknown";
  result.sources.genre ??= "unknown";
  result.sources.album ??= result.album ? "unknown" : undefined;
  result.sources.key ??= result.key ? "unknown" : undefined;
  result.status = getEnrichmentStatus(result.bpm, result.genre);

  if (errors.length > 0) {
    result.errors = errors;
  }

  if (result.operation === "enrich" || hasProviderEvidence(providerEvidence)) {
    const synthesized = await (dependencies.synthesize ?? synthesizeEnrichedTrackMetadata)({
      baseResult: result,
      providerEvidence,
    });

    return {
      ...synthesized,
      changedFields:
        result.operation === "enrich"
          ? getChangedFields(input.knownMetadata, synthesized)
          : undefined,
    };
  }

  return result;
}

async function applyContextProviders(
  result: EnrichedTrackMetadata,
  input: EnrichTrackMetadataInput,
  dependencies: EnrichmentDependencies,
  errors: string[],
): Promise<ProviderEvidence> {
  const providerInput = {
    title: result.trackName,
    artists: result.artist ?? (input.artist as string),
  };
  const wikipedia = await safeWikipediaLookup(
    dependencies.wikipediaLookup ?? lookupWikipediaContext,
    providerInput,
    errors,
  );
  addWikipediaToolStatus(result, wikipedia);

  return { wikipedia };
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

function applyKnownMetadata(
  result: EnrichedTrackMetadata,
  input: EnrichTrackMetadataInput,
) {
  const knownMetadata = input.knownMetadata;

  if (!knownMetadata) {
    return;
  }

  applyAlbum(result, knownMetadata.album, "unknown", 0.5);
  applyValue(result, "bpm", knownMetadata.bpm, "unknown", 0.5);
  applyValue(result, "genre", knownMetadata.genre, "unknown", 0.5);
  applyValue(result, "key", knownMetadata.key, "unknown", 0.5);
}

async function applyProviderFallbacks(
  result: EnrichedTrackMetadata,
  input: EnrichTrackMetadataInput,
  dependencies: EnrichmentDependencies,
  errors: string[],
): Promise<ProviderEvidence> {
  const evidence: ProviderEvidence = {};
  const providerInput = {
    title: result.trackName,
    artists: result.artist ?? (input.artist as string),
  };
  const shouldForceProviders = result.operation === "enrich";

  if (shouldForceProviders || !result.genre) {
    const spotify = await safeLookup(
      dependencies.spotifyLookup ?? lookupSpotifyTrack,
      providerInput,
      errors,
    );
    evidence.spotify = spotify;
    addToolStatus(result, "Spotify", spotify);
    applyProviderIdentity(result, spotify?.track);
    applyAlbum(result, getProviderAlbum(spotify), "spotify", 0.85);
    result.spotifyUrl ??= getProviderUrl(spotify);
    applyValue(result, "genre", spotify?.genre ?? null, "spotify", 0.65);
  }

  if (shouldForceProviders || !result.bpm || !result.genre) {
    const getSongBpm = await safeLookup(
      dependencies.getSongBpmLookup ?? lookupGetSongBpmTrack,
      providerInput,
      errors,
    );
    evidence.getSongBpm = getSongBpm;
    addToolStatus(result, "GetSongBPM", getSongBpm);
    applyProviderIdentity(result, getSongBpm?.track);
    applyAlbum(result, getProviderAlbum(getSongBpm), "getsongbpm", 0.65);
    applyValue(result, "bpm", getSongBpm?.bpm ?? null, "getsongbpm", 0.7);
    applyValue(result, "genre", getSongBpm?.genre ?? null, "getsongbpm", 0.55);

    if (!result.key) {
      applyValue(result, "key", getSongBpm?.key ?? null, "unknown", 0.4);
    }
  }

  return evidence;
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

function addWikipediaToolStatus(
  result: EnrichedTrackMetadata,
  lookupResult: WikipediaLookupResult | null,
) {
  result.toolsUsed ??= [];
  result.toolsUsed.push({
    name: "Wikipedia",
    matched: lookupResult?.found ?? false,
    url: lookupResult?.url ?? null,
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

async function safeWikipediaLookup(
  lookup: WikipediaLookup,
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

function shouldCallProviders(
  result: EnrichedTrackMetadata,
  input: EnrichTrackMetadataInput,
) {
  return Boolean(
    input.artist &&
      (result.operation === "enrich" || isMissingBpmOrGenre(result)),
  );
}

function shouldCallContextProviders(
  result: EnrichedTrackMetadata,
  input: EnrichTrackMetadataInput,
) {
  return Boolean(
    input.artist &&
      (result.operation === "enrich" ||
        result.genre === null ||
        result.summary === null),
  );
}

function hasProviderEvidence(providerEvidence: ProviderEvidence) {
  return Boolean(
    providerEvidence.spotify ||
      providerEvidence.getSongBpm ||
      hasFoundWikipediaEvidence(providerEvidence.wikipedia),
  );
}

function hasFoundWikipediaEvidence(value: unknown) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as { found?: unknown }).found === true,
  );
}

function getChangedFields(
  knownMetadata: EnrichTrackMetadataInput["knownMetadata"],
  result: EnrichedTrackMetadata,
): EnrichedTrackMetadata["changedFields"] {
  if (!knownMetadata) {
    return [];
  }

  return (["album", "bpm", "genre", "subGenre", "key", "spotifyUrl"] as const)
    .filter((field) => {
      if (!(field in knownMetadata)) {
        return false;
      }

      return normalizeComparableValue(knownMetadata[field]) !==
        normalizeComparableValue(getResultFieldValue(result, field));
    });
}

function getResultFieldValue(
  result: EnrichedTrackMetadata,
  field: NonNullable<EnrichedTrackMetadata["changedFields"]>[number],
) {
  return result[field];
}

function normalizeComparableValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "number") {
    return String(value);
  }

  return String(value).trim().toLowerCase();
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
  source: Extract<
    EnrichmentSource,
    "local_db" | "spotify" | "getsongbpm" | "unknown"
  >,
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
