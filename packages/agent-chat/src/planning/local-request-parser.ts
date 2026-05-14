import type {
  AnalyzeTrackToolInput,
  SearchRemixesToolInput,
} from "@track-lab/api-types";

export function isRemixRequest(content: string) {
  const lower = content.toLowerCase();
  return lower.includes("remix") || lower.includes("bootleg") || lower.includes("edit");
}

export function parseAnalyzeRequest(content: string): AnalyzeTrackToolInput {
  const parsed = parseTrackAndArtist(content);
  return {
    title: parsed.title,
    artists: parsed.artists,
    operation: "enrich",
  };
}

export function parseRemixRequest(content: string): SearchRemixesToolInput {
  const parsed = parseTrackAndArtist(content);
  const spotifyUrl = content.match(/https:\/\/open\.spotify\.com\/track\/[^\s)]+/i)?.[0];
  const genreMatch = content.match(/\b(?:genre|style)\s*[:=]\s*([a-z0-9 /&-]+)/i);

  return {
    title: parsed.title || null,
    artists: parsed.artists || null,
    spotifyUrl: spotifyUrl ?? null,
    genre: genreMatch?.[1]?.trim() || null,
  };
}

function parseTrackAndArtist(content: string) {
  const withoutSpotifyUrl = content.replace(
    /https:\/\/open\.spotify\.com\/track\/[^\s)]+/gi,
    "",
  );
  const explicitTrackMatch = withoutSpotifyUrl.match(
    /\b(?:track|song)\s+(?:called\s+|named\s+)?["']?(.+?)["']?\s+by\s+(.+)/i,
  );

  if (explicitTrackMatch) {
    return {
      title: cleanParsedValue(explicitTrackMatch[1] ?? ""),
      artists: cleanParsedValue(explicitTrackMatch[2] ?? ""),
    };
  }

  const cleaned = stripLeadingIntent(withoutSpotifyUrl)
    .replace(/\b(analyze|analyse|enrich|find|search|show|get|remixes?|edits?|bootlegs?|for|track)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const quoted = cleaned.match(/"([^"]+)"\s+(?:by|-)\s+(.+)/i);
  const byMatch = cleaned.match(/(.+?)\s+by\s+(.+)/i);
  const dashMatch = cleaned.match(/(.+?)\s+-\s+(.+)/);
  const match = quoted ?? byMatch ?? dashMatch;

  if (!match) {
    return {
      title: "",
      artists: "",
    };
  }

  return {
    title: cleanParsedValue(match[1] ?? ""),
    artists: cleanParsedValue(match[2] ?? ""),
  };
}

function stripLeadingIntent(value: string) {
  let next = value.trim();
  let previous = "";

  while (next !== previous) {
    previous = next;
    next = next
      .replace(/^(?:hi|hello|hey)[,\s]*/i, "")
      .replace(/^(?:please\s+)?(?:can|could)\s+you\s+/i, "")
      .replace(/^(?:i\s+want\s+to|i\s+need\s+to|i\s+would\s+like\s+to|i'd\s+like\s+to)\s+/i, "")
      .trim();
  }

  return next;
}

function cleanParsedValue(value: string) {
  return value
    .replace(/^(?:a\s+)?(?:track|song)\s+/i, "")
    .replace(/^(?:called|named)\s+/i, "")
    .replace(/\b(?:please|thanks|thank you)\b/gi, "")
    .replace(/[?.!]+$/g, "")
    .trim();
}
