import type { ToolStatus, TrackDetails } from "../types";
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

  const details = {
    bpm: matchLabeledValue(response, "BPM"),
    genre: matchLabeledValue(response, "Genre"),
    subGenre:
      matchLabeledValue(response, "SubGenre") ??
      matchLabeledValue(response, "Sub Genre"),
    key: matchLabeledValue(response, "Key"),
    summary:
      matchLabeledValue(response, "AI-generated summary") ??
      matchLabeledValue(response, "AI generated summary") ??
      matchLabeledValue(response, "Summary"),
    spotifyUrl: matchUrl(response, "open.spotify.com"),
  };

  return hasTrackDetails(details) ? details : null;
}

function extractTrackDetails(record: Record<string, unknown>): TrackDetails {
  const toolsUsed = extractToolStatuses(record);

  return {
    title: valueToString(findValue(record, ["title", "trackTitle", "track_title"])),
    artists: valueToString(findValue(record, ["artists", "artist", "artistNames"])),
    bpm: valueToString(findValue(record, ["bpm"])),
    genre: valueToString(findValue(record, ["genre"])),
    subGenre: valueToString(findValue(record, ["subGenre", "sub_genre"])),
    key: valueToString(findValue(record, ["key"])),
    summary: valueToString(
      findValue(record, [
        "ai-generated summary",
        "ai generated summary",
        "summary",
        "aiSummary",
        "ai_generated_summary",
      ]),
    ),
    spotifyUrl:
      valueToString(findValue(record, ["spotifyUrl", "spotify_url"])) ??
      findNestedProviderUrl(record, "spotify"),
    toolsUsed,
    errors: toolsUsed
      .filter((tool) => tool.error)
      .map((tool) => ({ source: tool.name, message: tool.error as string })),
  };
}

function extractToolStatuses(record: Record<string, unknown>): ToolStatus[] {
  return ["Spotify", "Beatport", "GetSongBPM"]
    .map((name) => {
      const value = findValue(record, [name]);

      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
      }

      const toolRecord = value as Record<string, unknown>;

      return {
        name,
        matched: valueToBoolean(findValue(toolRecord, ["matched"])),
        url: valueToString(findValue(toolRecord, ["url"])) ?? null,
        error: valueToString(findValue(toolRecord, ["error"])) ?? null,
      };
    })
    .filter((tool): tool is ToolStatus => Boolean(tool));
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

function hasTrackDetails(details: TrackDetails) {
  return Boolean(
    details.bpm ||
      details.genre ||
      details.subGenre ||
      details.key ||
      details.summary ||
      details.spotifyUrl,
  );
}
