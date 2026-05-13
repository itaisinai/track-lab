import type {
  NormalizedTrackResult,
  ResultError,
  ResultStatus,
  SaveTrackResultInput,
  ProviderExecutionStatus,
} from "./types.ts";
import {
  assertRecord,
  findValue,
  valueToBoolean,
  valueToNumber,
  valueToString,
} from "./lib/object.ts";

export function normalizeTrackResult(
  input: SaveTrackResultInput,
): NormalizedTrackResult {
  const record = assertRecord(input.json);
  const title = valueToString(
    findValue(record, ["title", "trackTitle", "track_title", "trackName"]),
  );
  const artists =
    valueToString(findValue(record, ["artists", "artist", "artistNames", "artist_names"])) ??
    stringifyArtistList(findValue(record, ["artistList", "artist_list"]));

  if (!title || !artists) {
    throw new Error("Saved enrichment response must include Title and Artists.");
  }

  const providersUsed = extractProviderExecutionStatuses(record);
  const errors = [
    ...extractResponseErrors(record),
    ...providersUsed
      .filter((provider) => provider.error)
      .map((provider) => ({
        source: provider.name,
        message: provider.error as string,
      })),
  ];

  const summary = valueToString(
    findValue(record, [
      "ai-generated summary",
      "ai generated summary",
      "aiSummary",
      "ai_generated_summary",
      "summary",
    ]),
  );
  const bpm = valueToNumber(findValue(record, ["bpm"]));
  const genre = valueToString(findValue(record, ["genre"]));

  return {
    title,
    artists,
    album:
      valueToString(findValue(record, ["album", "albumName", "album_name"])) ??
      findNestedAlbum(record) ??
      inferAlbumFromSummary(summary),
    bpm,
    genre,
    subGenre: valueToString(findValue(record, ["subGenre", "sub_genre"])),
    key: valueToString(findValue(record, ["key"])),
    summary,
    status: determineStatus(record, providersUsed, errors, bpm, genre),
    providersUsed,
    errors,
  };
}

function inferAlbumFromSummary(summary: string | null) {
  if (!summary) {
    return null;
  }

  const match = summary.match(
    /\bfrom\s+(?:the\s+)?(.+?)\s+album\b/i,
  );

  return match?.[1]?.trim().replace(/[,.!?;:]+$/, "") || null;
}

function findNestedAlbum(record: Record<string, unknown>) {
  const spotify = findValue(record, ["spotify"]);

  if (!spotify || typeof spotify !== "object" || Array.isArray(spotify)) {
    return null;
  }

  const track = findValue(spotify as Record<string, unknown>, ["track"]);

  if (!track || typeof track !== "object" || Array.isArray(track)) {
    return null;
  }

  return valueToString(findValue(track as Record<string, unknown>, ["album"]));
}

function extractProviderExecutionStatuses(record: Record<string, unknown>): ProviderExecutionStatus[] {
  const explicitStatuses = extractExplicitProviderExecutionStatuses(record);

  if (explicitStatuses.length > 0) {
    return explicitStatuses;
  }

  const providerStatuses = ["Spotify", "Beatport", "SoundCloud", "GetSongBPM", "Wikipedia"]
    .map((name) => {
      const value = findValue(record, [name]);

      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
      }

      const providerRecord = value as Record<string, unknown>;

      return {
        name,
        matched: valueToBoolean(findValue(providerRecord, ["matched"])),
        url: valueToString(findValue(providerRecord, ["url"])),
        error: valueToString(findValue(providerRecord, ["error"])),
      };
    })
    .filter((provider): provider is ProviderExecutionStatus => Boolean(provider));

  return providerStatuses.length > 0
    ? providerStatuses
    : extractSourceStatuses(record);
}

function extractExplicitProviderExecutionStatuses(record: Record<string, unknown>): ProviderExecutionStatus[] {
  const providersUsed = findValue(record, [
    "providersUsed",
    "providers_used",
    "toolsUsed",
    "tools_used",
  ]);

  if (!Array.isArray(providersUsed)) {
    return [];
  }

  return providersUsed
    .map((provider) => {
      if (!provider || typeof provider !== "object" || Array.isArray(provider)) {
        return null;
      }

      const providerRecord = provider as Record<string, unknown>;
      const name = valueToString(findValue(providerRecord, ["name"]));

      if (!name) {
        return null;
      }

      return {
        name,
        matched: valueToBoolean(findValue(providerRecord, ["matched"])),
        url: valueToString(findValue(providerRecord, ["url"])),
        error: valueToString(findValue(providerRecord, ["error"])),
      };
    })
    .filter((provider): provider is ProviderExecutionStatus => Boolean(provider));
}

function determineStatus(
  record: Record<string, unknown>,
  providersUsed: ProviderExecutionStatus[],
  errors: ResultError[],
  bpm: number | null,
  genre: string | null,
): ResultStatus {
  const enrichedStatus = valueToString(findValue(record, ["status"]));

  if (bpm && genre) {
    return "complete";
  }

  if (bpm || genre || enrichedStatus === "partial") {
    return "partial";
  }

  if (
    providersUsed.length === 0 ||
    providersUsed.every((provider) => provider.error)
  ) {
    return "failed";
  }

  if (
    errors.length > 0 ||
    providersUsed.some((provider) => provider.matched === false)
  ) {
    return "partial";
  }

  return "complete";
}

function extractSourceStatuses(record: Record<string, unknown>): ProviderExecutionStatus[] {
  const sources = findValue(record, ["sources"]);

  if (!sources || typeof sources !== "object" || Array.isArray(sources)) {
    return [];
  }

  return Array.from(
    new Set(
      Object.values(sources as Record<string, unknown>)
        .filter((source): source is string => typeof source === "string")
        .filter((source) => source !== "unknown"),
    ),
  ).map((source) => ({
    name: formatSourceName(source),
    matched: source !== "audio_analysis",
    url: null,
    error: null,
  }));
}

function extractResponseErrors(record: Record<string, unknown>): ResultError[] {
  const errors = findValue(record, ["errors"]);

  if (!Array.isArray(errors)) {
    return [];
  }

  return errors
    .map((error) => valueToString(error))
    .filter((error): error is string => Boolean(error))
    .map((message) => ({ source: "Metadata Enrichment", message }));
}

function formatSourceName(source: string) {
  const names: Record<string, string> = {
    local_db: "Local DB",
    audio_analysis: "Audio Analysis",
    spotify: "Spotify",
    getsongbpm: "GetSongBPM",
    lastfm: "Last.fm",
  };

  return names[source] ?? source;
}

function stringifyArtistList(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const artists = value
    .map((artist) => valueToString(artist))
    .filter((artist): artist is string => Boolean(artist));

  return artists.length > 0 ? artists.join(", ") : null;
}
