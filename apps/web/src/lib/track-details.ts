import type { ProviderStatus, TrackDetails } from "../types";
import { valueToString } from "./format";

export function parseTrackDetails(response: string): TrackDetails | null {
  const parsed = parseJsonFromResponse(response);

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    const details = extractTrackDetails(record);

    if (hasTrackDetails(details)) {
      return details;
    }

    for (const content of findContentStrings(record)) {
      const nestedDetails = parseTrackDetails(content);

      if (nestedDetails) {
        return nestedDetails;
      }
    }
  }

  const summary =
    matchLabeledValue(response, "AI-generated summary") ??
    matchLabeledValue(response, "AI generated summary") ??
    matchLabeledValue(response, "Summary");
  const details = {
    title: matchLabeledValue(response, "Title"),
    artists:
      matchLabeledValue(response, "Artists") ??
      matchLabeledValue(response, "Artist"),
    album: matchLabeledValue(response, "Album") ?? inferAlbumFromSummary(summary),
    bpm: matchLabeledValue(response, "BPM"),
    genre: matchLabeledValue(response, "Genre"),
    subGenre:
      matchLabeledValue(response, "SubGenre") ??
      matchLabeledValue(response, "Sub Genre"),
    key: matchLabeledValue(response, "Key"),
    summary,
    spotifyUrl: matchUrl(response, "open.spotify.com"),
  };

  return hasTrackDetails(details) ? details : null;
}

function extractTrackDetails(record: Record<string, unknown>): TrackDetails {
  const providerStatuses = extractProviderStatuses(record);
  const summary = valueToString(
    findValue(record, [
      "ai-generated summary",
      "ai generated summary",
      "summary",
      "aiSummary",
      "ai_generated_summary",
    ]),
  );

  return {
    title: valueToString(
      findValue(record, ["title", "trackTitle", "track_title", "trackName"]),
    ),
    artists: valueToString(findValue(record, ["artists", "artist", "artistNames"])),
    album:
      valueToString(findValue(record, ["album", "albumName", "album_name"])) ??
      findNestedAlbum(record) ??
      inferAlbumFromSummary(summary),
    bpm: valueToString(findValue(record, ["bpm"])),
    genre: valueToString(findValue(record, ["genre"])),
    subGenre: valueToString(findValue(record, ["subGenre", "sub_genre"])),
    key: valueToString(findValue(record, ["key"])),
    summary,
    spotifyUrl:
      valueToString(findValue(record, ["spotifyUrl", "spotify_url"])) ??
      findNestedProviderUrl(record, "spotify"),
    toolsUsed: providerStatuses,
    changedFields: extractChangedFields(record),
    reviewNotes: extractStringList(record, ["reviewNotes", "review_notes"]),
    conflicts: extractStringList(record, ["conflicts"]),
    errors: [
      ...extractResponseErrors(record),
      ...providerStatuses
        .filter((provider) => provider.error)
        .map((provider) => ({
          source: provider.name,
          message: provider.error as string,
        })),
    ],
  };
}

function extractChangedFields(record: Record<string, unknown>) {
  const value = findValue(record, ["changedFields", "changed_fields"]);

  if (!Array.isArray(value)) {
    return undefined;
  }

  const allowedFields = new Set([
    "album",
    "bpm",
    "genre",
    "subGenre",
    "key",
    "spotifyUrl",
  ]);
  const fields = value
    .filter((item): item is string => typeof item === "string")
    .filter((item) => allowedFields.has(item));

  return fields.length > 0
    ? (fields as NonNullable<TrackDetails["changedFields"]>)
    : undefined;
}

function extractStringList(record: Record<string, unknown>, names: string[]) {
  const value = findValue(record, names);

  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value
    .map((item) => valueToString(item))
    .filter((item): item is string => Boolean(item));

  return values.length > 0 ? values : undefined;
}

function extractProviderStatuses(record: Record<string, unknown>): ProviderStatus[] {
  const explicitStatuses = extractExplicitProviderStatuses(record);

  if (explicitStatuses.length > 0) {
    return explicitStatuses;
  }

  const providerStatuses = ["Spotify", "Beatport", "GetSongBPM"]
    .map((name) => {
      const value = findValue(record, [name]);

      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
      }

      const providerRecord = value as Record<string, unknown>;

      return {
        name,
        matched: valueToBoolean(findValue(providerRecord, ["matched"])),
        url: valueToString(findValue(providerRecord, ["url"])) ?? null,
        error: valueToString(findValue(providerRecord, ["error"])) ?? null,
      };
    })
    .filter((provider): provider is ProviderStatus => Boolean(provider));

  return providerStatuses.length > 0
    ? providerStatuses
    : extractSourceStatuses(record);
}

function extractExplicitProviderStatuses(
  record: Record<string, unknown>,
): ProviderStatus[] {
  const toolsUsed = findValue(record, ["toolsUsed", "tools_used"]);

  if (!Array.isArray(toolsUsed)) {
    return [];
  }

  return toolsUsed
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
        url: valueToString(findValue(providerRecord, ["url"])) ?? null,
        error: valueToString(findValue(providerRecord, ["error"])) ?? null,
      };
    })
    .filter((provider): provider is ProviderStatus => Boolean(provider));
}

function extractSourceStatuses(record: Record<string, unknown>): ProviderStatus[] {
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

function extractResponseErrors(record: Record<string, unknown>) {
  const errors = findValue(record, ["errors"]);

  if (!Array.isArray(errors)) {
    return [];
  }

  return errors
    .map((error) => valueToString(error))
    .filter((error): error is string => Boolean(error))
    .map((message) => ({ source: "Agent", message }));
}

function parseJsonFromResponse(response: string): unknown {
  const fencedJson = response.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fencedJson ?? response;

  try {
    return JSON.parse(candidate);
  } catch {
    const objectText = candidate.match(/\{[\s\S]*\}/)?.[0];
    if (!objectText) {
      return null;
    }

    try {
      return JSON.parse(objectText);
    } catch {
      return null;
    }
  }
}

function findContentStrings(value: unknown): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(findContentStrings);
  }

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, nestedValue]) => {
      if (normalizeKey(key) === "content" && typeof nestedValue === "string") {
        return [nestedValue];
      }

      return findContentStrings(nestedValue);
    },
  );
}

function findValue(record: Record<string, unknown>, names: string[]) {
  const normalizedNames = new Set(names.map(normalizeKey));
  const entry = Object.entries(record).find(([key]) =>
    normalizedNames.has(normalizeKey(key)),
  );

  return entry?.[1];
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function valueToBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function matchLabeledValue(response: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = response.match(
    new RegExp(
      `${escapedLabel}\\s*[:\\-]\\s*(.+?)(?=\\n\\s*[A-Za-z][^\\n:]{0,40}\\s*[:\\-]|$)`,
      "is",
    ),
  );

  return match?.[1].trim();
}

function matchUrl(response: string, domain: string) {
  return response.match(new RegExp(`https?://[^\\s"']*${domain}[^\\s"']*`, "i"))
    ?.[0];
}

function findNestedProviderUrl(
  record: Record<string, unknown>,
  provider: string,
) {
  const value = Object.entries(record).find(
    ([key]) => normalizeKey(key) === provider,
  )?.[1];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return valueToString(findValue(value as Record<string, unknown>, ["url"]));
}

function findNestedAlbum(record: Record<string, unknown>) {
  const spotify = findValue(record, ["spotify"]);

  if (!spotify || typeof spotify !== "object" || Array.isArray(spotify)) {
    return undefined;
  }

  const track = findValue(spotify as Record<string, unknown>, ["track"]);

  if (!track || typeof track !== "object" || Array.isArray(track)) {
    return undefined;
  }

  return valueToString(findValue(track as Record<string, unknown>, ["album"]));
}

function inferAlbumFromSummary(summary: string | undefined) {
  if (!summary) {
    return undefined;
  }

  const match = summary.match(
    /\bfrom\s+(?:the\s+)?(.+?)\s+album\b/i,
  );

  return match?.[1]?.trim().replace(/[,.!?;:]+$/, "") || undefined;
}

function hasTrackDetails(details: TrackDetails) {
  return Boolean(
    details.bpm ||
      details.title ||
      details.artists ||
      details.album ||
      details.genre ||
      details.subGenre ||
      details.key ||
      details.summary ||
      details.spotifyUrl,
  );
}
