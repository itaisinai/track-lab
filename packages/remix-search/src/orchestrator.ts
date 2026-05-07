import type {
  RemixSearchOriginalTrack,
  RemixSearchRequest,
  RemixSearchResponse,
} from "@track-lab/api-types";
import { createRemixSearchQueries } from "./query-planner.ts";
import { rankAndFilterRemixCandidates } from "./llm-ranker.ts";
import { logRemixSearch } from "@track-lab/logger";
import { soundCloudRemixProvider } from "./providers/soundcloud.ts";
import { soundCloudWebSearchProvider } from "./providers/soundcloud-web-search.ts";
import {
  resolveSpotifyTrack,
  spotifyRemixProvider,
} from "./providers/spotify.ts";
import type {
  NormalizedRemixSearchRequest,
  RemixSearchProviderModule,
} from "./types.ts";

export class RemixSearchOrchestrator {
  private readonly providers: RemixSearchProviderModule[];

  constructor(
    providers = [
      soundCloudWebSearchProvider,
      soundCloudRemixProvider,
      spotifyRemixProvider,
    ],
  ) {
    this.providers = providers;
  }

  async search(request: RemixSearchRequest): Promise<RemixSearchResponse> {
    logRemixSearch("request received", {
      hasSpotifyUrl: Boolean(request.spotifyUrl),
      title: request.title ?? null,
      artists: request.artists ?? null,
      genre: request.genre ?? null,
    });
    const normalized = await normalizeRequest(request);
    logRemixSearch("request normalized", normalized);
    const originalTrack = await getOriginalTrack(normalized);
    logRemixSearch("original track resolved", originalTrack);
    const queries = createRemixSearchQueries(normalized);
    logRemixSearch("queries planned", {
      count: queries.length,
      queries,
    });
    const providerResults = await Promise.allSettled(
      this.providers.map((provider) =>
        provider.search({
          request: normalized,
          originalTrack,
          queries,
        }),
      ),
    );
    const candidates = providerResults.flatMap((result, index) => {
      const providerName = this.providers[index]?.name ?? "unknown";

      if (result.status === "rejected") {
        logRemixSearch("provider failed", {
          provider: providerName,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
        return [];
      }

      logRemixSearch("provider completed", {
        provider: providerName,
        candidates: result.value.length,
      });
      return result.value;
    });
    const rankedCandidates = await rankAndFilterRemixCandidates(
      candidates,
      normalized,
    );
    logRemixSearch("candidates ranked", {
      rawCandidates: candidates.length,
      returnedCandidates: rankedCandidates.length,
      topCandidates: rankedCandidates.slice(0, 5).map((candidate) => ({
        title: candidate.title,
        artists: candidate.artists,
        provider: candidate.provider,
        confidence: candidate.confidence,
      })),
    });

    return {
      originalTrack,
      requestedGenre: normalized.genre,
      candidates: rankedCandidates,
    };
  }
}

async function normalizeRequest(
  request: RemixSearchRequest,
): Promise<NormalizedRemixSearchRequest> {
  const spotifyTrack = await resolveSpotifyTrack(request.spotifyUrl);
  const title = spotifyTrack?.title ?? request.title?.trim();
  const artists = spotifyTrack?.artists ?? request.artists?.trim();

  if (!title || !artists) {
    throw new Error("Provide a Spotify URL or both title and artists.");
  }

  return {
    title,
    artists,
    spotifyUrl: spotifyTrack?.spotifyUrl ?? request.spotifyUrl?.trim() ?? null,
    genre: request.genre?.trim() || null,
  };
}

async function getOriginalTrack(
  request: NormalizedRemixSearchRequest,
): Promise<RemixSearchOriginalTrack> {
  const spotifyTrack = await resolveSpotifyTrack(request.spotifyUrl);

  return {
    title: spotifyTrack?.title ?? request.title,
    artists: spotifyTrack?.artists ?? request.artists,
    spotifyUrl: spotifyTrack?.spotifyUrl ?? request.spotifyUrl,
    album: spotifyTrack?.album ?? null,
    durationMs: spotifyTrack?.durationMs ?? null,
  };
}
