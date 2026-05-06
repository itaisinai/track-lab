import type {
  RemixSearchCandidate,
  RemixSearchOriginalTrack,
} from "@track-lab/api-types";
import { logRemixProvider } from "../logger.ts";
import { extractRemixArtist } from "../scoring.ts";
import type { RemixSearchContext, RemixSearchProviderModule } from "../types.ts";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_URL = "https://api.spotify.com/v1";

type SpotifyToken = {
  accessToken: string;
  expiresAt: number;
};

type SpotifyTrack = {
  id: string;
  name: string;
  duration_ms?: number;
  external_urls?: {
    spotify?: string;
  };
  album?: {
    name?: string;
    release_date?: string;
  };
  artists: Array<{
    name: string;
  }>;
};

type SpotifySearchResponse = {
  tracks?: {
    items?: SpotifyTrack[];
  };
};

let cachedToken: SpotifyToken | null = null;

export const spotifyRemixProvider: RemixSearchProviderModule = {
  name: "Spotify",
  async search(context: RemixSearchContext) {
    logRemixProvider("spotify", "search started", {
      queries: context.queries.slice(0, 8).length,
    });
    const token = await getSpotifyAccessTokenOrNull();

    if (!token) {
      logRemixProvider("spotify", "skipped missing credentials");
      return [];
    }

    const candidates: RemixSearchCandidate[] = [];

    for (const query of context.queries.slice(0, 8)) {
      logRemixProvider("spotify", "query started", { query });
      const tracks = await searchTracks(token, query);
      logRemixProvider("spotify", "query completed", {
        query,
        tracks: tracks.length,
      });

      candidates.push(
        ...tracks.map((track) => mapSpotifyTrackToCandidate(track)),
      );
    }

    logRemixProvider("spotify", "search completed", {
      candidates: candidates.length,
    });
    return candidates;
  },
};

export async function resolveSpotifyTrack(
  spotifyUrl: string | null | undefined,
): Promise<RemixSearchOriginalTrack | null> {
  const trackId = extractSpotifyTrackId(spotifyUrl);

  if (!trackId) {
    return null;
  }

  logRemixProvider("spotify", "resolving spotify track", { trackId });
  const token = await getSpotifyAccessTokenOrNull();

  if (!token) {
    logRemixProvider("spotify", "resolve skipped missing credentials");
    return null;
  }

  const response = await spotifyFetch(token, `/tracks/${trackId}`);
  const track = await parseSpotifyResponse<SpotifyTrack>(response);

  logRemixProvider("spotify", "spotify track resolved", {
    title: track.name,
    artists: track.artists.map((artist) => artist.name).join(", "),
  });
  return {
    title: track.name,
    artists: track.artists.map((artist) => artist.name).join(", "),
    spotifyUrl: track.external_urls?.spotify ?? spotifyUrl ?? null,
    album: track.album?.name ?? null,
    durationMs: track.duration_ms ?? null,
  };
}

async function searchTracks(token: string, query: string) {
  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: "10",
  });
  const response = await spotifyFetch(token, `/search?${params.toString()}`);
  const data = await parseSpotifyResponse<SpotifySearchResponse>(response);

  return data.tracks?.items ?? [];
}

function mapSpotifyTrackToCandidate(track: SpotifyTrack): RemixSearchCandidate {
  return {
    title: track.name,
    artists: track.artists.map((artist) => artist.name).join(", "),
    remixArtist: extractRemixArtist(track.name),
    album: track.album?.name ?? null,
    genre: null,
    subGenre: null,
    bpm: null,
    provider: "Spotify",
    link: track.external_urls?.spotify ?? "",
    createdAt: track.album?.release_date ?? null,
    durationMs: track.duration_ms ?? null,
    confidence: 0,
    relevanceReason: "",
  };
}

async function getSpotifyAccessTokenOrNull() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }),
  });
  const data = await parseSpotifyResponse<{
    access_token: string;
    expires_in: number;
  }>(response);

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.accessToken;
}

function spotifyFetch(token: string, path: string) {
  return fetch(`${SPOTIFY_API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function parseSpotifyResponse<T>(response: Response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      typeof data?.error === "object" && data.error?.message
        ? data.error.message
        : "Spotify request failed.",
    );
  }

  return data as T;
}

function extractSpotifyTrackId(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  return url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/)?.[1] ?? null;
}
