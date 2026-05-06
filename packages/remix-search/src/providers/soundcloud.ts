import type { RemixSearchCandidate } from "@track-lab/api-types";
import { logRemixProvider } from "../logger.ts";
import { extractRemixArtist } from "../scoring.ts";
import type { RemixSearchContext, RemixSearchProviderModule } from "../types.ts";

const SOUNDCLOUD_TOKEN_URL = "https://secure.soundcloud.com/oauth/token";
const SOUNDCLOUD_API_URL = "https://api.soundcloud.com";

type SoundCloudToken = {
  accessToken: string;
  expiresAt: number;
};

type SoundCloudTrack = {
  title?: string;
  permalink_url?: string;
  created_at?: string;
  duration?: number;
  genre?: string;
  tag_list?: string;
  playback_count?: number;
  likes_count?: number;
  favoritings_count?: number;
  user?: {
    username?: string;
  };
};

let cachedToken: SoundCloudToken | null = null;

export const soundCloudRemixProvider: RemixSearchProviderModule = {
  name: "SoundCloud",
  async search(context: RemixSearchContext) {
    logRemixProvider("soundcloud", "search started", {
      queries: context.queries.length,
      genre: context.request.genre,
    });
    const token = await getSoundCloudAccessTokenOrNull();

    if (!token) {
      logRemixProvider("soundcloud", "skipped missing credentials");
      return [];
    }

    const candidates: RemixSearchCandidate[] = [];

    for (const query of context.queries) {
      logRemixProvider("soundcloud", "query started", { query });
      const tracks = await searchTracks(token, query, context.request.genre);
      logRemixProvider("soundcloud", "query completed", {
        query,
        tracks: tracks.length,
      });
      candidates.push(
        ...tracks.map((track) => mapSoundCloudTrackToCandidate(track)),
      );
    }

    logRemixProvider("soundcloud", "search completed", {
      candidates: candidates.length,
    });
    return candidates;
  },
};

async function searchTracks(
  token: string,
  query: string,
  genre: string | null,
) {
  const params = new URLSearchParams({
    q: query,
    access: "playable",
    limit: "20",
    linked_partitioning: "false",
  });

  if (genre) {
    params.set("genres", genre);
  }

  const response = await fetch(
    `${SOUNDCLOUD_API_URL}/tracks?${params.toString()}`,
    {
      headers: {
        Authorization: `OAuth ${token}`,
        Accept: "application/json; charset=utf-8",
      },
    },
  );
  const data = await parseSoundCloudResponse<SoundCloudTrack[] | { collection?: SoundCloudTrack[] }>(
    response,
  );

  return Array.isArray(data) ? data : data.collection ?? [];
}

function mapSoundCloudTrackToCandidate(
  track: SoundCloudTrack,
): RemixSearchCandidate {
  return {
    title: track.title ?? "Untitled",
    artists: track.user?.username ?? "Unknown",
    remixArtist: extractRemixArtist(track.title ?? "") ?? track.user?.username ?? null,
    album: null,
    genre: track.genre || firstTag(track.tag_list) || null,
    subGenre: track.tag_list || null,
    bpm: null,
    provider: "SoundCloud",
    link: track.permalink_url ?? "",
    createdAt: track.created_at ?? null,
    durationMs: track.duration ?? null,
    confidence: 0,
    relevanceReason: "",
  };
}

async function getSoundCloudAccessTokenOrNull() {
  if (process.env.SOUNDCLOUD_ACCESS_TOKEN) {
    return process.env.SOUNDCLOUD_ACCESS_TOKEN;
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  const response = await fetch(SOUNDCLOUD_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const data = await parseSoundCloudResponse<{
    access_token: string;
    expires_in?: number;
  }>(response);

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };

  return cachedToken.accessToken;
}

async function parseSoundCloudResponse<T>(response: Response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      data?.error_description ?? data?.message ?? "SoundCloud request failed.",
    );
  }

  return data as T;
}

function firstTag(tagList: string | undefined) {
  return tagList?.match(/"([^"]+)"|(\S+)/)?.[1] ?? tagList?.match(/"([^"]+)"|(\S+)/)?.[2] ?? null;
}
