import type {
  NormalizedTrackResult,
  ResultError,
  ResultStatus,
  SaveTrackResultInput,
  ToolStatus,
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
  const title = valueToString(findValue(record, ["title", "trackTitle", "track_title"]));
  const artists =
    valueToString(findValue(record, ["artists", "artist", "artistNames", "artist_names"])) ??
    stringifyArtistList(findValue(record, ["artistList", "artist_list"]));

  if (!title || !artists) {
    throw new Error("Saved agent response must include Title and Artists.");
  }

  const toolsUsed = extractToolStatuses(record);
  const errors = toolsUsed
    .filter((tool) => tool.error)
    .map((tool) => ({ source: tool.name, message: tool.error as string }));

  const summary = valueToString(
    findValue(record, [
      "ai-generated summary",
      "ai generated summary",
      "aiSummary",
      "ai_generated_summary",
      "summary",
    ]),
  );

  return {
    title,
    artists,
    album:
      valueToString(findValue(record, ["album", "albumName", "album_name"])) ??
      findNestedAlbum(record) ??
      inferAlbumFromSummary(summary),
    bpm: valueToNumber(findValue(record, ["bpm"])),
    genre: valueToString(findValue(record, ["genre"])),
    subGenre: valueToString(findValue(record, ["subGenre", "sub_genre"])),
    key: valueToString(findValue(record, ["key"])),
    summary,
    status: determineStatus(toolsUsed, errors),
    toolsUsed,
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
        url: valueToString(findValue(toolRecord, ["url"])),
        error: valueToString(findValue(toolRecord, ["error"])),
      };
    })
    .filter((tool): tool is ToolStatus => Boolean(tool));
}

function determineStatus(
  toolsUsed: ToolStatus[],
  errors: ResultError[],
): ResultStatus {
  if (toolsUsed.length === 0 || toolsUsed.every((tool) => tool.error)) {
    return "failed";
  }

  if (errors.length > 0 || toolsUsed.some((tool) => tool.matched === false)) {
    return "partial";
  }

  return "complete";
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
