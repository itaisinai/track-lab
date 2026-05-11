import type {
  RemixSearchOriginalTrack,
  RemixSearchRequest,
  RemixSearchResponse,
} from "@track-lab/api-types";
import { createRemixSearchQueries } from "./query-planner.ts";
import { logRemixSearch } from "@track-lab/logger";
import { soundCloudRemixProvider } from "./providers/soundcloud.ts";
import { soundCloudWebSearchProvider } from "./providers/soundcloud-web-search.ts";
import {
  resolveSpotifyTrack,
  spotifyRemixProvider,
} from "./providers/spotify.ts";
import { searchRemixProviders } from "./search/remix-provider-search.ts";
import { judgeRemixCandidates } from "./judge/remix-candidate-judge.ts";
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
    logRemixSearch("request normalized", {
      title: normalized.title,
      artists: normalized.artists,
      spotifyUrl: normalized.spotifyUrl,
      genre: normalized.genre,
    });
    const originalTrack = getOriginalTrack(normalized);
    logRemixSearch("original track resolved", originalTrack);
    const queries = createRemixSearchQueries(normalized);
    logRemixSearch("queries planned", {
      count: queries.length,
      queries,
    });
    const candidates = await searchRemixProviders(this.providers, {
      request: normalized,
      originalTrack,
      queries,
    });
    logRemixSearch("provider search completed", {
      candidates: candidates.length,
    });
    const rankedCandidates = await judgeRemixCandidates(
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
): Promise<NormalizedRemixSearchRequest & { spotifyTrack: RemixSearchOriginalTrack | null }> {
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
    spotifyTrack: spotifyTrack
      ? {
          title: spotifyTrack.title,
          artists: spotifyTrack.artists,
          spotifyUrl: spotifyTrack.spotifyUrl,
          album: spotifyTrack.album,
          durationMs: spotifyTrack.durationMs,
        }
      : null,
  };
}

function getOriginalTrack(
  request: NormalizedRemixSearchRequest & { spotifyTrack: RemixSearchOriginalTrack | null },
): RemixSearchOriginalTrack {
  return {
    title: request.spotifyTrack?.title ?? request.title,
    artists: request.spotifyTrack?.artists ?? request.artists,
    spotifyUrl: request.spotifyTrack?.spotifyUrl ?? request.spotifyUrl,
    album: request.spotifyTrack?.album ?? null,
    durationMs: request.spotifyTrack?.durationMs ?? null,
  };
}
