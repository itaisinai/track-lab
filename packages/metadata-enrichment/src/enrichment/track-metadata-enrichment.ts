import {
  createBpmMetadataProviders,
  createEdmCatalogMetadataProviders,
  createRequiredMetadataProviders,
  createWikipediaContextProvider,
  type TrackMetadataProvider,
  type TrackMetadataProviderInput,
  type TrackMetadataProviderResult,
} from "@track-lab/providers";
import { getEnrichmentStatus } from "./enrichment-status.ts";
import type { EnrichmentResultStore } from "./enrichment-result-store.ts";
import {
  synthesizeEnrichedTrackMetadata,
} from "./metadata-synthesizer.ts";
import type { ProviderEvidence } from "./provider-evidence.ts";
import type {
  EnrichedTrackMetadata,
  EnrichTrackMetadataInput,
  EnrichmentSource,
} from "./types.ts";
import {
  planMetadataProviders,
  type MetadataProviderPlan,
} from "../planning/metadata-provider-planner.ts";

export type EnrichmentDependencies = {
  store?: EnrichmentResultStore;
  requiredProviders?: TrackMetadataProvider[];
  bpmProviders?: TrackMetadataProvider[];
  edmCatalogProviders?: TrackMetadataProvider[];
  providers?: TrackMetadataProvider[];
  contextProviders?: TrackMetadataProvider[];
  planProviders?: typeof planMetadataProviders;
  synthesize?: typeof synthesizeEnrichedTrackMetadata;
};

export async function enrichTrackMetadata(
  input: EnrichTrackMetadataInput,
  dependencies: EnrichmentDependencies = {},
): Promise<EnrichedTrackMetadata> {
  const errors: string[] = [];
  const result = createBaseResult(input);
  applyKnownMetadata(result, input);
  await applyLocalResultIfNeeded(result, input, dependencies);

  const providerEvidence: ProviderEvidence = {};
  const providerPlan = await collectProviderEvidence(
    result,
    input,
    dependencies,
    errors,
    providerEvidence,
  );
  await collectContextEvidence(
    result,
    input,
    dependencies,
    errors,
    providerEvidence,
    providerPlan,
  );

  finalizeEnrichmentStatus(result, errors);

  if (result.operation === "enrich" || hasProviderEvidence(providerEvidence)) {
    return synthesizeFinalMetadata(
      result,
      input,
      providerEvidence,
      dependencies,
    );
  }

  return result;
}

function createBaseResult(
  input: EnrichTrackMetadataInput,
): EnrichedTrackMetadata {
  return {
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
    providersUsed: [],
    status: "missing",
  };
}

async function applyLocalResultIfNeeded(
  result: EnrichedTrackMetadata,
  input: EnrichTrackMetadataInput,
  dependencies: EnrichmentDependencies,
) {
  if (result.operation !== "analyze") {
    return;
  }

  applyLocalResult(
    result,
    await dependencies.store?.findByTrack(input.trackName, input.artist),
  );
}

async function collectProviderEvidence(
  result: EnrichedTrackMetadata,
  input: EnrichTrackMetadataInput,
  dependencies: EnrichmentDependencies,
  errors: string[],
  providerEvidence: ProviderEvidence,
) {
  if (!shouldCallProviders(result, input)) {
    return null;
  }

  const providerStrategy = await applyProviderStrategy(
    result,
    input,
    dependencies,
    errors,
    providerEvidence,
  );

  Object.assign(providerEvidence, providerStrategy.providerEvidence);
  return providerStrategy.providerPlan;
}

async function collectContextEvidence(
  result: EnrichedTrackMetadata,
  input: EnrichTrackMetadataInput,
  dependencies: EnrichmentDependencies,
  errors: string[],
  providerEvidence: ProviderEvidence,
  providerPlan: MetadataProviderPlan | null,
) {
  if (!shouldCallContextProviders(result, input, providerPlan)) {
    return;
  }

  Object.assign(
    providerEvidence,
    await applyContextProviders(result, input, dependencies, errors),
  );
}

function finalizeEnrichmentStatus(
  result: EnrichedTrackMetadata,
  errors: string[],
) {
  result.sources.bpm ??= "unknown";
  result.sources.genre ??= "unknown";
  result.sources.subGenre ??= result.subGenre ? "unknown" : undefined;
  result.sources.album ??= result.album ? "unknown" : undefined;
  result.sources.key ??= result.key ? "unknown" : undefined;
  result.status = getEnrichmentStatus(result.bpm, result.genre);

  if (errors.length > 0) {
    result.errors = errors;
  }
}

async function synthesizeFinalMetadata(
  result: EnrichedTrackMetadata,
  input: EnrichTrackMetadataInput,
  providerEvidence: ProviderEvidence,
  dependencies: EnrichmentDependencies,
) {
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
    addProviderStatus(result, provider, providerResult);

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
  result.sources.trackName = "local_db";
  result.artist = localResult.artists;
  result.sources.artist = "local_db";
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
  applyValue(result, "subGenre", knownMetadata.subGenre, "unknown", 0.9);
  applyValue(result, "key", knownMetadata.key, "unknown", 0.9);
}

async function applyProviderStrategy(
  result: EnrichedTrackMetadata,
  input: EnrichTrackMetadataInput,
  dependencies: EnrichmentDependencies,
  errors: string[],
  providerEvidence: ProviderEvidence,
): Promise<{ providerEvidence: ProviderEvidence; providerPlan: MetadataProviderPlan }> {
  const evidence: ProviderEvidence = {};
  const providerInput = {
    trackName: result.trackName,
    artist: result.artist ?? input.artist,
  };

  if (dependencies.providers) {
    await lookupProviders(dependencies.providers, providerInput, result, evidence, errors, {
      stopWhenAcceptable: true,
    });

    return {
      providerEvidence: evidence,
      providerPlan: {
        lookupBpmProvider: false,
        lookupEdmCatalogProviders: false,
        lookupContextProvider: shouldCallContextProviders(result, input, null),
        reasons: ["Explicit provider override used."],
        strategyContext: {
          policy: [],
          providerRules: [],
          userPreferences: [],
        },
        edmProviderDecision: {
          classification: "unknown",
          shouldRunEdmProviders: false,
          providersToRun: [],
          confidence: "low",
          reason: "Explicit provider override used.",
          decidedBy: "fallback",
        },
      },
    };
  }

  const requiredProviders =
    dependencies.requiredProviders ??
    createRequiredMetadataProviders();

  await lookupProviders(requiredProviders, providerInput, result, evidence, errors, {
    stopWhenAcceptable: true,
  });

  const providerPlan = await (dependencies.planProviders ?? planMetadataProviders)({
    input,
    currentResult: result,
    providerEvidence: {
      ...providerEvidence,
      ...evidence,
    },
  });

  if (providerPlan.lookupBpmProvider && !hasAcceptableBpmAndGenre(result)) {
    await lookupProviders(
      dependencies.bpmProviders ?? createBpmMetadataProviders(),
      providerInput,
      result,
      evidence,
      errors,
      { stopWhenAcceptable: true },
    );
  }

  if (providerPlan.lookupEdmCatalogProviders) {
    await lookupProviders(
      dependencies.edmCatalogProviders ?? createEdmCatalogMetadataProviders(),
      providerInput,
      result,
      evidence,
      errors,
      { stopWhenAcceptable: false },
    );
  }

  return { providerEvidence: evidence, providerPlan };
}

async function lookupProviders(
  providers: TrackMetadataProvider[],
  providerInput: TrackMetadataProviderInput,
  result: EnrichedTrackMetadata,
  evidence: ProviderEvidence,
  errors: string[],
  options: { stopWhenAcceptable: boolean },
) {
  for (const provider of providers) {
    const nextProviderInput = {
      trackName: result.trackName,
      artist: result.artist ?? providerInput.artist,
    };
    const providerResult = await safeProviderLookup(provider, nextProviderInput, errors);
    addProviderStatus(result, provider, providerResult);

    if (!providerResult) {
      continue;
    }

    setProviderEvidence(
      evidence,
      providerResult.source,
      providerResult.raw ?? providerResult,
    );
    applyProviderResult(result, providerResult);

    if (options.stopWhenAcceptable && hasAcceptableBpmAndGenre(result)) {
      break;
    }
  }
}

function addProviderStatus(
  result: EnrichedTrackMetadata,
  provider: TrackMetadataProvider,
  lookupResult: TrackMetadataProviderResult | null,
) {
  result.providersUsed ??= [];
  result.providersUsed.push({
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
  field: "bpm" | "genre" | "subGenre" | "key",
  value: number | string | null | undefined,
  source: EnrichmentSource,
  confidence: number,
) {
  if (value === null || value === undefined || value === "") {
    return;
  }

  const currentSource = result.sources[field] ?? "unknown";
  const currentConfidence = result.confidence[field] ?? 0;

  if (
    result[field] &&
    !shouldReplaceMetadataValue(
      field,
      currentSource,
      source,
      currentConfidence,
      confidence,
    )
  ) {
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

  applyProviderIdentity(result, providerResult.matchedTrack, source);
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
  applyValue(
    result,
    "subGenre",
    providerResult.subGenre ?? null,
    source,
    providerResult.confidence,
  );
  applyValue(result, "key", providerResult.key, source, providerResult.confidence);
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
    key === "soundcloud" ||
    key === "wikipedia"
  ) {
    evidence[key] = value;
  }
}

function getEnrichmentSource(source: string): EnrichmentSource {
  return source === "spotify" ||
    source === "beatport" ||
    source === "getsongbpm" ||
    source === "soundcloud" ||
    source === "lastfm"
    ? source
    : "unknown";
}

function getAlbumSource(
  source: EnrichmentSource,
): EnrichedTrackMetadata["sources"]["album"] {
  return source === "lastfm" || source === "soundcloud" ? "unknown" : source;
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
  providerPlan: MetadataProviderPlan | null,
) {
  if (providerPlan) {
    return providerPlan.lookupContextProvider;
  }

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
      providerEvidence.soundcloud ||
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
  source: EnrichmentSource,
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

  applyIdentityValue(result, "trackName", title, source);
  applyIdentityValue(result, "artist", artists, source);
}

function applyAlbum(
  result: EnrichedTrackMetadata,
  album: string | null | undefined,
  source: EnrichedTrackMetadata["sources"]["album"],
  confidence: number,
) {
  if (!album) {
    return;
  }

  const currentSource = result.sources.album ?? "unknown";
  const nextSource = source ?? "unknown";
  const currentConfidence = result.confidence.album ?? 0;

  if (
    result.album &&
    !shouldReplaceMetadataValue(
      "album",
      currentSource,
      nextSource,
      currentConfidence,
      confidence,
    )
  ) {
    return;
  }

  result.album = album;
  result.sources.album = source;
  result.confidence.album = confidence;
}

function applyIdentityValue(
  result: EnrichedTrackMetadata,
  field: "trackName" | "artist",
  value: string | null | undefined,
  source: EnrichmentSource,
) {
  if (!value) {
    return;
  }

  const currentSource = result.sources[field];
  const nextSource = getIdentitySource(source);
  const nextPriority = getSourcePriority(field, nextSource);
  const currentPriority = getSourcePriority(field, currentSource);

  if (result[field] && currentPriority > nextPriority) {
    return;
  }

  result[field] = value;
  result.sources[field] = nextSource as never;
}

function getIdentitySource(source: EnrichmentSource) {
  return source === "lastfm" ? "unknown" : source;
}

function getStringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function shouldReplaceMetadataValue(
  field: "album" | "bpm" | "genre" | "subGenre" | "key" | "trackName" | "artist",
  currentSource: EnrichmentSource,
  nextSource: EnrichmentSource,
  currentConfidence: number,
  nextConfidence: number,
) {
  if (currentSource === "unknown" || nextSource === "unknown") {
    return nextConfidence > currentConfidence;
  }

  const currentPriority = getSourcePriority(field, currentSource as never);
  const nextPriority = getSourcePriority(field, nextSource as never);

  if (nextPriority !== currentPriority) {
    return nextPriority > currentPriority;
  }

  return nextConfidence > currentConfidence;
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

function getSourcePriority(
  field:
    | "trackName"
    | "artist"
    | "bpm"
    | "genre"
    | "subGenre"
    | "album"
    | "key",
  source: EnrichedTrackMetadata["sources"][typeof field],
) {
  const normalized = source ?? "unknown";

  const priorities: Record<
    typeof field,
    Partial<Record<string, number>>
  > = {
    trackName: {
      local_db: 4,
      spotify: 3,
      beatport: 2,
      getsongbpm: 1,
      soundcloud: 0,
      lastfm: 0,
      unknown: 0,
    },
    artist: {
      local_db: 4,
      spotify: 3,
      beatport: 2,
      getsongbpm: 1,
      soundcloud: 0,
      lastfm: 0,
      unknown: 0,
    },
    bpm: {
      local_db: 4,
      beatport: 3,
      getsongbpm: 2,
      spotify: 1,
      soundcloud: 0,
      lastfm: 0,
      unknown: 0,
    },
    genre: {
      local_db: 4,
      beatport: 3,
      spotify: 2,
      soundcloud: 1,
      lastfm: 1,
      getsongbpm: 0,
      unknown: 0,
    },
    subGenre: {
      local_db: 4,
      beatport: 3,
      spotify: 2,
      soundcloud: 1,
      lastfm: 1,
      getsongbpm: 0,
      unknown: 0,
    },
    album: {
      local_db: 4,
      spotify: 3,
      beatport: 2,
      soundcloud: 1,
      getsongbpm: 1,
      lastfm: 0,
      unknown: 0,
    },
    key: {
      local_db: 4,
      beatport: 3,
      getsongbpm: 2,
      spotify: 1,
      soundcloud: 0,
      lastfm: 0,
      unknown: 0,
    },
  };

  return priorities[field][normalized] ?? 0;
}
