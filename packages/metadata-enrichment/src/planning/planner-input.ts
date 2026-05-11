import type { ProviderEvidence } from "../enrichment/llm-synthesis.ts";
import type { EnrichedTrackMetadata } from "../enrichment/types.ts";

export type PlannerCurrentResultSummary = {
  trackName: string;
  artist?: string;
  genre: string | null;
  subGenre: string | null;
  hasBpm: boolean;
  hasKey: boolean;
  matchedProviders: string[];
  confidence: {
    bpm?: number;
    genre?: number;
    subGenre?: number;
    album?: number;
    key?: number;
  };
};

export type PlannerProviderEvidenceSummary = {
  spotify?: string | null;
  beatport?: string | null;
  getSongBpm?: string | null;
  soundcloud?: string | null;
  wikipedia?: string | null;
};

export function toPlannerCurrentResultSummary(
  result: EnrichedTrackMetadata,
): PlannerCurrentResultSummary {
  const matchedProviders = [
    result.sources.trackName,
    result.sources.artist,
    result.sources.album,
    result.sources.bpm,
    result.sources.genre,
    result.sources.subGenre,
    result.sources.key,
  ].flatMap((source) => (isRecordedSource(source) ? [source] : []));

  return {
    trackName: result.trackName,
    artist: result.artist,
    genre: result.genre,
    subGenre: result.subGenre ?? null,
    hasBpm: Boolean(result.bpm),
    hasKey: Boolean(result.key),
    matchedProviders,
    confidence: {
      bpm: result.confidence.bpm,
      genre: result.confidence.genre,
      subGenre: result.confidence.subGenre,
      album: result.confidence.album,
      key: result.confidence.key,
    },
  };
}

export function toPlannerProviderEvidenceSummary(
  providerEvidence: ProviderEvidence,
): PlannerProviderEvidenceSummary {
  return {
    spotify: summarizeEvidence(providerEvidence.spotify, ["title", "artists", "genres", "url"]),
    beatport: summarizeEvidence(providerEvidence.beatport, ["title", "artists", "bpm", "genre", "subGenre", "key", "url"]),
    getSongBpm: summarizeEvidence(providerEvidence.getSongBpm, ["title", "artists", "bpm", "key", "url"]),
    soundcloud: summarizeEvidence(providerEvidence.soundcloud, ["title", "artists", "genre", "subGenre", "url"]),
    wikipedia: summarizeEvidence(providerEvidence.wikipedia, ["found", "title", "extract", "url"]),
  };
}

function summarizeEvidence(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const summary = keys
    .map((key) => {
      const item = record[key];
      if (item === null || item === undefined || item === "") {
        return null;
      }

      if (typeof item === "string") {
        return `${key}=${trimText(item)}`;
      }

      if (typeof item === "number" || typeof item === "boolean") {
        return `${key}=${String(item)}`;
      }

      if (Array.isArray(item)) {
        return `${key}=[${item.slice(0, 3).map((entry) => trimText(String(entry))).join(", ")}${item.length > 3 ? ", ..." : ""}]`;
      }

      return `${key}={...}`;
    })
    .filter((entry): entry is string => Boolean(entry));

  if (summary.length === 0) {
    return null;
  }

  return summary.join("; ").slice(0, 240);
}

function trimText(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 80);
}

function isRecordedSource(
  source: EnrichedTrackMetadata["sources"][keyof EnrichedTrackMetadata["sources"]] | undefined,
): source is Exclude<
  EnrichedTrackMetadata["sources"][keyof EnrichedTrackMetadata["sources"]],
  undefined | "unknown"
> {
  return Boolean(source && source !== "unknown");
}
