import { config } from "../config.ts";
import type { ProviderTrackLookupResult, TrackLookupInput } from "./types.ts";
import { normalize, unique } from "./utils.ts";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_URL = "https://api.spotify.com/v1";

type SpotifyToken = {
  accessToken: string;
  expiresAt: number;
};

type SpotifySearchResponse = {
  tracks?: {
    items?: SpotifyTrack[];
  };
};

type SpotifyTrack = {
  id: string;
  name: string;
  uri: string;
  external_urls?: {
    spotify?: string;
  };
  album?: {
    name?: string;
    release_date?: string;
    images?: Array<{
      url: string;
      width: number | null;
      height: number | null;
    }>;
  };
  artists: Array<{
    id: string;
    name: string;
  }>;
};

type SpotifyArtistsResponse = {
  artists?: Array<{
    id: string;
    name: string;
    genres?: string[];
  }>;
};

let cachedToken: SpotifyToken | null = null;

export async function lookupSpotifyTrack({
  title,
  artists,
}: TrackLookupInput): Promise<ProviderTrackLookupResult> {
  if (!config.spotify.clientId || !config.spotify.clientSecret) {
    return {
      found: false,
      source: "spotify",
      bpm: null,
      genre: null,
      genres: [],
      url: null,
      track: null,
      note: "Spotify credentials are not configured.",
    };
  }

  let token: string;
  let track: SpotifyTrack | null;

  try {
    token = await getSpotifyAccessToken();
    track = await searchTrack(token, title, artists);
  } catch (error) {
    return {
      found: false,
      source: "spotify",
      bpm: null,
      genre: null,
      genres: [],
      url: null,
      track: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (!track) {
    return {
      found: false,
      source: "spotify",
      bpm: null,
      genre: null,
      url: null,
      note: "No matching Spotify track found.",
    };
  }

  let genres: string[] = [];

  try {
    const artistDetails = await getArtists(
      token,
      track.artists.map((artist) => artist.id),
    );
    genres = unique(
      artistDetails.flatMap((artist) => artist.genres ?? []).filter(Boolean),
    );
  } catch {
    genres = [];
  }

  return {
    found: true,
    source: "spotify",
    bpm: null,
    genre: genres[0] ?? null,
    genres,
    url: track.external_urls?.spotify ?? null,
    track: {
      id: track.id,
      title: track.name,
      artists: track.artists.map((artist) => artist.name),
      artistGenres: genres,
      album: track.album?.name ?? null,
      releaseDate: track.album?.release_date ?? null,
      spotifyUrl: track.external_urls?.spotify ?? null,
      uri: track.uri,
      imageUrl: track.album?.images?.[0]?.url ?? null,
    },
  };
}

async function getSpotifyAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const clientId = config.spotify.clientId;
  const clientSecret = config.spotify.clientSecret;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET environment variables.",
    );
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
  }>(response, "token");

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.accessToken;
}

async function searchTrack(token: string, title: string, artists: string) {
  const primaryArtist = artists.split(",")[0]?.trim() ?? artists.trim();
  const query = `track:"${title}" artist:"${primaryArtist}"`;
  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: "5",
  });

  const response = await spotifyFetch(token, `/search?${params.toString()}`);
  const data = await parseSpotifyResponse<SpotifySearchResponse>(
    response,
    "search",
  );
  const tracks = data.tracks?.items ?? [];

  return findBestTrackMatch(tracks, title, artists) ?? tracks[0] ?? null;
}

async function getArtists(token: string, artistIds: string[]) {
  const ids = unique(artistIds).slice(0, 50);

  if (ids.length === 0) {
    return [];
  }

  const params = new URLSearchParams({
    ids: ids.join(","),
  });

  const response = await spotifyFetch(token, `/artists?${params.toString()}`);
  const data = await parseSpotifyResponse<SpotifyArtistsResponse>(
    response,
    "artists",
  );

  return data.artists ?? [];
}

function spotifyFetch(token: string, path: string) {
  return fetch(`${SPOTIFY_API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function parseSpotifyResponse<T>(response: Response, step: string) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    throw new Error(
      `Spotify ${step} API error ${response.status}: ${JSON.stringify(data)}${
        retryAfter ? ` Retry after ${retryAfter}s.` : ""
      }`,
    );
  }

  return data as T;
}

function findBestTrackMatch(
  tracks: SpotifyTrack[],
  title: string,
  artists: string,
) {
  const normalizedTitle = normalize(title);
  const normalizedArtists = artists.split(",").map(normalize).filter(Boolean);

  return tracks.find((track) => {
    const titleMatches = normalize(track.name) === normalizedTitle;
    const trackArtists = track.artists.map((artist) => normalize(artist.name));
    const artistMatches = normalizedArtists.every((artist) =>
      trackArtists.some((trackArtist) => trackArtist.includes(artist)),
    );

    return titleMatches && artistMatches;
  });
}
