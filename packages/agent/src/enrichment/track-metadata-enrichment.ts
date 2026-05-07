import {
  createDefaultProviders,
  createWikipediaContextProvider,
  type TrackMetadataProvider,
  type TrackMetadataProviderInput,
  type TrackMetadataProviderResult,
} from "@track-lab/providers";
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

export type EnrichmentDependencies = {
  store?: EnrichmentResultStore;
  providers?: TrackMetadataProvider[];
  contextProviders?: TrackMetadataProvider[];
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
      trackName: result.trackName,
      artist: result.artist,
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
    trackName: result.trackName,
    artist: result.artist ?? input.artist,
  };
  const evidence: ProviderEvidence = {};

  for (const provider of dependencies.contextProviders ?? [createWikipediaContextProvider()]) {
    const providerResult = await safeProviderLookup(provider, providerInput, errors);
    addToolStatus(result, provider, providerResult);

    if (providerResult?.raw) {
      setProviderEvidence(evidence, providerResult.source, providerResult.raw);
    }
  }

  return evidence;
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

  applyAlbum(result, knownMetadata.album, "unknown", 0.9);
  applyValue(result, "bpm", knownMetadata.bpm, "unknown", 0.9);
  applyValue(result, "genre", knownMetadata.genre, "unknown", 0.9);
  applyValue(result, "key", knownMetadata.key, "unknown", 0.9);
}

async function applyProviderFallbacks(
  result: EnrichedTrackMetadata,
  input: EnrichTrackMetadataInput,
  dependencies: EnrichmentDependencies,
  errors: string[],
): Promise<ProviderEvidence> {
  const evidence: ProviderEvidence = {};
  const providerInput = {
    trackName: result.trackName,
    artist: result.artist ?? input.artist,
  };
  const providers = dependencies.providers ?? createDefaultProviders();

  for (const provider of providers) {
    const providerResult = await safeProviderLookup(provider, providerInput, errors);
    addToolStatus(result, provider, providerResult);

    if (!providerResult) {
      continue;
    }

    setProviderEvidence(
      evidence,
      providerResult.source,
      providerResult.raw ?? providerResult,
    );
    applyProviderResult(result, providerResult);

    if (hasAcceptableBpmAndGenre(result)) {
      break;
    }
  }

  return evidence;
}

function addToolStatus(
  result: EnrichedTrackMetadata,
  provider: TrackMetadataProvider,
  lookupResult: TrackMetadataProviderResult | null,
) {
  result.toolsUsed ??= [];
  result.toolsUsed.push({
    name: provider.name,
    matched: Boolean(lookupResult),
    url: lookupResult?.url ?? null,
    error: null,
  });
}

async function safeProviderLookup(
  provider: TrackMetadataProvider,
  input: TrackMetadataProviderInput,
  errors: string[],
) {
  try {
    return await provider.lookup(input);
  } catch (error) {
    errors.push(`${provider.name}: ${error instanceof Error ? error.message : String(error)}`);
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

  if (result[field] && (result.confidence[field] ?? 0) >= confidence) {
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

function applyProviderResult(
  result: EnrichedTrackMetadata,
  providerResult: TrackMetadataProviderResult,
) {
  const source = getEnrichmentSource(providerResult.source);

  applyProviderIdentity(result, providerResult.matchedTrack);
  applyAlbum(
    result,
    providerResult.album,
    getAlbumSource(source),
    providerResult.confidence,
  );
  result.spotifyUrl ??= providerResult.source === "spotify"
    ? providerResult.url ?? undefined
    : undefined;
  applyValue(result, "bpm", providerResult.bpm, source, providerResult.confidence);
  applyValue(result, "genre", providerResult.genre, source, providerResult.confidence);
  applyValue(result, "key", providerResult.key, source, providerResult.confidence);
  applySubGenre(result, providerResult.subGenre ?? null);
}

function hasAcceptableBpmAndGenre(result: EnrichedTrackMetadata) {
  return Boolean(
    result.bpm &&
      result.genre &&
      (result.confidence.bpm ?? 0) >= 0.6 &&
      (result.confidence.genre ?? 0) >= 0.6,
  );
}

function setProviderEvidence(
  evidence: ProviderEvidence,
  source: string,
  value: unknown,
) {
  const key = source === "getsongbpm" ? "getSongBpm" : source;

  if (
    key === "spotify" ||
    key === "beatport" ||
    key === "getSongBpm" ||
    key === "wikipedia"
  ) {
    evidence[key] = value;
  }
}

function getEnrichmentSource(source: string): EnrichmentSource {
  return source === "spotify" ||
    source === "beatport" ||
    source === "getsongbpm" ||
    source === "lastfm"
    ? source
    : "unknown";
}

function getAlbumSource(
  source: EnrichmentSource,
): EnrichedTrackMetadata["sources"]["album"] {
  return source === "lastfm" ? "unknown" : source;
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
      providerEvidence.beatport ||
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
    getStringListValue(record.artists) ??
    getStringValue(record.artists) ??
    getStringValue(record.artist);

  result.trackName = title ?? result.trackName;
  result.artist = artists ?? result.artist;
}

function applyAlbum(
  result: EnrichedTrackMetadata,
  album: string | null | undefined,
  source: EnrichedTrackMetadata["sources"]["album"],
  confidence: number,
) {
  if (!album || result.album) {
    return;
  }

  result.album = album;
  result.sources.album = source;
  result.confidence.album = confidence;
}

function applySubGenre(
  result: EnrichedTrackMetadata,
  subGenre: string | null | undefined,
) {
  if (!subGenre || result.subGenre) {
    return;
  }

  result.subGenre = subGenre;
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
