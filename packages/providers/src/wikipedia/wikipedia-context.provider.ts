import type { TrackLookupInput } from "../shared/types.ts";
import type {
  TrackMetadataProvider,
  TrackMetadataProviderInput,
  TrackMetadataProviderResult,
} from "../base/types.ts";
import { logProviderSearch } from "../shared/utils.ts";
import {
  fetchWikipediaExtract,
  getWikipediaPageUrl,
  getWikipediaSearchTerms,
  searchWikipedia,
  type WikipediaLookupResult,
} from "./context-utils.ts";

export function createWikipediaContextProvider(): TrackMetadataProvider {
  return {
    name: "Wikipedia",
    lookup(input: TrackMetadataProviderInput) {
      return lookupTrackContext(input);
    },
  };
}

async function lookupTrackContext({
  trackName,
  artist,
}: TrackMetadataProviderInput): Promise<TrackMetadataProviderResult | null> {
  if (!artist) {
    return null;
  }

  const result = await lookupWikipediaContext({
    title: trackName,
    artists: artist,
  });

  if (!result.found && !result.extract) {
    return null;
  }

  return {
    tags: result.title ? [result.title] : [],
    source: "wikipedia",
    confidence: 0.45,
    url: result.url,
    raw: result,
  };
}

export async function lookupWikipediaContext({
  title,
  artists,
}: TrackLookupInput): Promise<WikipediaLookupResult> {
  logProviderSearch("wikipedia", "search started", { title, artists });

  for (const searchTerm of getWikipediaSearchTerms({ title, artists })) {
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

      const resolvedTitle = page.title ?? pageTitle;
      logProviderSearch("wikipedia", "matched page", {
        title: resolvedTitle,
        url: getWikipediaPageUrl(resolvedTitle),
      });

      return {
        found: true,
        source: "wikipedia",
        title: resolvedTitle,
        extract: page.extract,
        url: getWikipediaPageUrl(resolvedTitle),
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

export type { WikipediaLookupResult };
