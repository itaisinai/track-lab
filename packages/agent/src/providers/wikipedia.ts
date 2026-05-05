import type { TrackLookupInput } from "./types.ts";
import { logProviderSearch } from "./utils.ts";

const WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php";
const WIKIPEDIA_PAGE_URL = "https://en.wikipedia.org/wiki/";

export type WikipediaLookupResult = {
  found: boolean;
  source: "wikipedia";
  title: string | null;
  extract: string | null;
  url: string | null;
  error?: string | null;
};

type WikipediaSearchResponse = {
  query?: {
    search?: Array<{
      title?: string;
    }>;
  };
};

type WikipediaExtractResponse = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        extract?: string;
        missing?: boolean;
      }
    >;
  };
};

export async function lookupWikipediaContext({
  title,
  artists,
}: TrackLookupInput): Promise<WikipediaLookupResult> {
  logProviderSearch("wikipedia", "search started", { title, artists });
  const searchTerms = [
    primaryArtist(artists),
    `${title} ${primaryArtist(artists)}`,
  ].filter(Boolean);

  for (const searchTerm of searchTerms) {
    try {
      logProviderSearch("wikipedia", "requesting search", { searchTerm });
      const pageTitle = await searchWikipedia(searchTerm);

      if (!pageTitle) {
        logProviderSearch("wikipedia", "no page for search term", {
          searchTerm,
        });
        continue;
      }

      logProviderSearch("wikipedia", "page candidate", { pageTitle });
      const page = await fetchWikipediaExtract(pageTitle);

      if (!page?.extract) {
        logProviderSearch("wikipedia", "page missing extract", { pageTitle });
        continue;
      }

      logProviderSearch("wikipedia", "matched page", {
        title: page.title ?? pageTitle,
        url: `${WIKIPEDIA_PAGE_URL}${encodeURIComponent(page.title ?? pageTitle).replace(/%20/g, "_")}`,
      });

      return {
        found: true,
        source: "wikipedia",
        title: page.title ?? pageTitle,
        extract: page.extract,
        url: `${WIKIPEDIA_PAGE_URL}${encodeURIComponent(page.title ?? pageTitle).replace(/%20/g, "_")}`,
        error: null,
      };
    } catch (error) {
      logProviderSearch("wikipedia", "search failed", {
        searchTerm,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        found: false,
        source: "wikipedia",
        title: null,
        extract: null,
        url: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  logProviderSearch("wikipedia", "no match", { title, artists });
  return {
    found: false,
    source: "wikipedia",
    title: null,
    extract: null,
    url: null,
    error: null,
  };
}

async function searchWikipedia(searchTerm: string) {
  const data = await wikipediaFetch<WikipediaSearchResponse>({
    action: "query",
    list: "search",
    srsearch: searchTerm,
    srlimit: "1",
  });

  return data.query?.search?.[0]?.title ?? null;
}

async function fetchWikipediaExtract(title: string) {
  const data = await wikipediaFetch<WikipediaExtractResponse>({
    action: "query",
    prop: "extracts",
    exintro: "1",
    explaintext: "1",
    redirects: "1",
    titles: title,
  });
  const pages = Object.values(data.query?.pages ?? {});
  const page = pages.find((candidate) => !candidate.missing);

  return page
    ? {
        title: page.title ?? title,
        extract: page.extract ?? null,
      }
    : null;
}

async function wikipediaFetch<T>(params: Record<string, string>) {
  const url = new URL(WIKIPEDIA_API_URL);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url, {
    headers: {
      "User-Agent": "TrackLab/0.1 local metadata enrichment",
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `Wikipedia API error ${response.status}: ${JSON.stringify(data)}`,
    );
  }

  return data as T;
}

function primaryArtist(artists: string) {
  return artists.split(",")[0]?.trim() ?? artists.trim();
}
