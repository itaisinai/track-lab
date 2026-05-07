import type { RemixSearchCandidate } from "@track-lab/api-types";

const SOUNDCLOUD_OEMBED_URL = "https://soundcloud.com/oembed";
const SOUNDCLOUD_SEARCH_URL = "https://soundcloud.com/search";

export type SoundCloudWebSearchContext = {
  queries: string[];
  genre?: string | null;
};

export type SoundCloudWebSearchLogger = (
  message: string,
  details?: Record<string, unknown>,
) => void;

export type SoundCloudWebSearchProvider = {
  name: "SoundCloud";
  search(context: SoundCloudWebSearchContext): Promise<RemixSearchCandidate[]>;
};

export type SoundCloudWebSearchResult = RemixSearchCandidate;

export type SoundCloudWebSearchOptions = {
  logger?: SoundCloudWebSearchLogger;
  extractRemixArtist?: (title: string) => string | null;
  searxngSearchUrl?: string | null;
};

type WebSearchResult = {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
};

type SearxngSearchResponse = {
  results?: SearxngSearchResult[];
};

type SearxngSearchResult = {
  title?: string;
  url?: string;
  content?: string;
  publishedDate?: string;
};

type SoundCloudOEmbedResponse = {
  title?: string;
  description?: string;
  provider_name?: string;
};

type SoundCloudPageMetadata = {
  createdAt?: string | null;
  durationMs?: number | null;
  genre?: string | null;
  subGenre?: string | null;
};

export function createSoundCloudWebSearchProvider(
  options: SoundCloudWebSearchOptions = {},
): SoundCloudWebSearchProvider {
  return {
    name: "SoundCloud",
    search(context: SoundCloudWebSearchContext) {
      return searchSoundCloudWebTracks(context, options);
    },
  };
}

export async function searchSoundCloudWebTracks(
  context: SoundCloudWebSearchContext,
  options: SoundCloudWebSearchOptions = {},
): Promise<SoundCloudWebSearchResult[]> {
  let searxngSearchUrl =
    options.searxngSearchUrl ?? getSearxngSearchUrl();
  const log = options.logger ?? noopLogger;

  log("search started", {
    queries: context.queries.slice(0, 8).length,
    genre: context.genre ?? null,
    searxngConfigured: Boolean(searxngSearchUrl),
  });

  const candidates: RemixSearchCandidate[] = [];

  for (const query of context.queries.slice(0, 8)) {
    const soundCloudQuery = `site:soundcloud.com ${query}`;
    log("query started", {
      query: soundCloudQuery,
      source: searxngSearchUrl ? "searxng" : "soundcloud-public",
    });
    const { results, disabledSearxng } = await searchSoundCloudWeb(
      searxngSearchUrl,
      soundCloudQuery,
      log,
    );

    if (disabledSearxng) {
      searxngSearchUrl = null;
    }

    log("query completed", {
      query: soundCloudQuery,
      source: getSearchSource(disabledSearxng, searxngSearchUrl),
      results: results.length,
    });

    for (const result of results) {
      const soundCloudUrl = getSoundCloudTrackUrl(result.url);

      if (!soundCloudUrl) {
        continue;
      }

      candidates.push(
        await mapSearchResultToCandidate(soundCloudUrl, result, options),
      );
    }
  }

  log("search completed", {
    candidates: candidates.length,
  });
  return candidates;
}

async function searchSearxng(searchUrl: string, query: string) {
  const url = new URL(searchUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });
  const data = await parseJsonResponse<SearxngSearchResponse>(
    response,
    "SearXNG SoundCloud search failed.",
  );

  return (data.results ?? []).map((result) => ({
    title: result.title,
    url: result.url,
    description: result.content,
    age: result.publishedDate,
  }));
}

async function searchSoundCloudWeb(
  searxngSearchUrl: string | null,
  query: string,
  log: SoundCloudWebSearchLogger,
): Promise<{ results: WebSearchResult[]; disabledSearxng: boolean }> {
  if (searxngSearchUrl) {
    try {
      return {
        results: await searchSearxng(searxngSearchUrl, query),
        disabledSearxng: false,
      };
    } catch (error) {
      log(
        "searxng failed, disabling for this search and using direct fallback",
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );

      return {
        results: await searchSoundCloudPublicPage(query),
        disabledSearxng: true,
      };
    }
  }

  return {
    results: await searchSoundCloudPublicPage(query),
    disabledSearxng: false,
  };
}

async function searchSoundCloudPublicPage(query: string) {
  const url = new URL(SOUNDCLOUD_SEARCH_URL);
  url.searchParams.set("q", query.replace(/^site:soundcloud\.com\s+/i, ""));
  const response = await fetch(url, {
    headers: {
      Accept: "text/html",
      "User-Agent":
        "Mozilla/5.0 (compatible; TrackLabRemixSearch/1.0; +https://soundcloud.com)",
    },
  });
  const html = await response.text();

  if (!response.ok) {
    throw new Error(`SoundCloud public search failed with ${response.status}.`);
  }

  return parseSoundCloudSearchHtml(html);
}

async function mapSearchResultToCandidate(
  link: string,
  result: WebSearchResult,
  options: SoundCloudWebSearchOptions,
): Promise<RemixSearchCandidate> {
  const [embed, pageMetadata] = await Promise.all([
    getSoundCloudOEmbedOrNull(link),
    getSoundCloudPageMetadataOrNull(link),
  ]);
  const parsedTitle = parseSoundCloudTitle(embed?.title ?? result.title ?? "");
  const title = parsedTitle.title || cleanSearchTitle(result.title) || "Untitled";
  const artists = parsedTitle.artist || "Unknown";
  const snippet = [result.description, embed?.description]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");

  return {
    title,
    artists,
    remixArtist: options.extractRemixArtist?.(title) ?? artists,
    album: null,
    genre: pageMetadata?.genre ?? null,
    subGenre: pageMetadata?.subGenre ?? null,
    bpm: null,
    provider: "SoundCloud",
    link,
    createdAt: pageMetadata?.createdAt ?? normalizeSearchAge(result.age),
    durationMs: pageMetadata?.durationMs ?? null,
    confidence: 0,
    relevanceReason: snippet ? `Search context: ${snippet}` : "",
  };
}

async function getSoundCloudPageMetadataOrNull(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html",
        "User-Agent":
          "Mozilla/5.0 (compatible; TrackLabRemixSearch/1.0; +https://soundcloud.com)",
      },
    });

    if (!response.ok) {
      return null;
    }

    return parseSoundCloudTrackPageMetadata(await response.text());
  } catch {
    return null;
  }
}

async function getSoundCloudOEmbedOrNull(url: string) {
  const params = new URLSearchParams({
    format: "json",
    url,
  });

  try {
    const response = await fetch(`${SOUNDCLOUD_OEMBED_URL}?${params.toString()}`);

    if (!response.ok) {
      return null;
    }

    return parseJsonResponse<SoundCloudOEmbedResponse>(
      response,
      "SoundCloud oEmbed failed.",
    );
  } catch {
    return null;
  }
}

function getSoundCloudTrackUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, "");

    if (hostname !== "soundcloud.com") {
      return null;
    }

    const pathParts = url.pathname.split("/").filter(Boolean);

    if (pathParts.length < 2 || pathParts[0] === "sets") {
      return null;
    }

    if (isNonTrackPath(pathParts[0]) || isNonTrackPath(pathParts[1])) {
      return null;
    }

    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function isNonTrackPath(path: string) {
  return [
    "discover",
    "feed",
    "for-you",
    "likes",
    "messages",
    "pages",
    "popular",
    "search",
    "sets",
    "stream",
    "tags",
    "upload",
  ].includes(path.toLowerCase());
}

function parseSoundCloudTitle(value: string) {
  const cleaned = cleanSearchTitle(value);
  const byMatch = cleaned.match(/^(.*?)\s+by\s+(.+)$/i);

  if (byMatch?.[1] && byMatch[2]) {
    return {
      title: byMatch[1].trim(),
      artist: byMatch[2].trim(),
    };
  }

  return {
    title: cleaned,
    artist: null,
  };
}

function cleanSearchTitle(value: string | undefined) {
  return (
    value
      ?.replace(/\s*\|\s*free listening on soundcloud\s*$/i, "")
      .replace(/\s+by\s+.+?\s+\|\s+listen online/i, "")
      .replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

function normalizeSearchAge(value: string | undefined) {
  return value?.trim() || null;
}

function getSearxngSearchUrl() {
  return process.env.SEARXNG_SEARCH_URL?.trim() || null;
}

function getSearchSource(
  disabledSearxng: boolean,
  searxngSearchUrl: string | null,
) {
  return disabledSearxng || !searxngSearchUrl
    ? "soundcloud-public"
    : "searxng";
}

function noopLogger() {
  return;
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string) {
  const text = await response.text();
  let data: unknown = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    const preview = text.replace(/\s+/g, " ").slice(0, 80);
    throw new Error(
      `${fallbackMessage} Expected JSON but received ${response.headers.get("content-type") ?? "unknown content"}: ${preview}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      hasStringMessage(data) ? data.message : fallbackMessage,
    );
  }

  return data as T;
}

function parseSoundCloudSearchHtml(html: string): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  const anchorPattern = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html))) {
    const path = decodeHtml(match[1] ?? "");
    const title = decodeHtml(stripHtml(match[2] ?? ""));
    const url = getAbsoluteSoundCloudUrl(path);

    if (!url || !title) {
      continue;
    }

    results.push({
      title,
      url,
    });
  }

  return results;
}

function parseSoundCloudTrackPageMetadata(html: string): SoundCloudPageMetadata {
  const createdAt =
    getHydratedSoundField(html, "created_at") ??
    getHydratedSoundField(html, "display_date") ??
    getDecodedHtmlString(
      html.match(/<time[^>]*pubdate[^>]*>([^<]+)<\/time>/i)?.[1],
    ) ??
    null;
  const durationMs = getHydratedSoundNumberField(html, "duration");
  const genre = getHydratedSoundField(html, "genre");
  const subGenre = getHydratedSoundField(html, "tag_list");

  return {
    createdAt,
    durationMs,
    genre,
    subGenre,
  };
}

function getHydratedSoundField(html: string, field: string) {
  const pattern = new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`);
  const value = html.match(pattern)?.[1];

  return value ? decodeJsonString(value) : null;
}

function getHydratedSoundNumberField(html: string, field: string) {
  const pattern = new RegExp(`"${field}"\\s*:\\s*(\\d+)`);
  const value = html.match(pattern)?.[1];

  return value ? Number(value) : null;
}

function getAbsoluteSoundCloudUrl(path: string) {
  if (path.startsWith("https://soundcloud.com/")) {
    return path;
  }

  if (!path.startsWith("/")) {
    return null;
  }

  return `https://soundcloud.com${path}`;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function getDecodedHtmlString(value: string | undefined) {
  const decoded = decodeHtml(value ?? "");
  return decoded || null;
}

function decodeJsonString(value: string) {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value.replace(/\\u0026/g, "&").replace(/\\"/g, '"').trim();
  }
}

function hasStringMessage(value: unknown): value is { message: string } {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).message === "string"
  );
}

export const soundCloudWebSearchInternals = {
  getSoundCloudTrackUrl,
  getSearxngSearchUrl,
  parseSoundCloudTrackPageMetadata,
  parseSoundCloudSearchHtml,
  parseSoundCloudTitle,
};
