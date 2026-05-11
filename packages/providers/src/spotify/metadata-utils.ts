import { logProviderSearch, normalize, unique } from "../shared/utils.ts";
import {
  createTitleFirstTrackQueries,
  normalizeTrackLookupInput,
} from "../shared/track-query.ts";

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

export type SpotifyTrack = {
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

export function hasSpotifyCredentials() {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

export async function getSpotifyAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

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

export async function searchSpotifyTrack(
  token: string,
  title: string,
  artists: string,
) {
  const input = normalizeTrackLookupInput(title, artists);
  const queries = [
    `track:"${input.matchTitle}" artist:"${input.primaryArtist}"`,
    ...createTitleFirstTrackQueries(input.title, input.artists),
  ];

  for (const query of unique(queries)) {
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
    const match = findBestTrackMatch(tracks, input.matchTitle, input.artists) ?? null;

    logProviderSearch("spotify", "search results", {
      query,
      candidates: tracks.length,
      selected: match?.name ?? null,
    });

    if (match) {
      return match;
    }
  }

  return null;
}

export async function getSpotifyArtists(token: string, artistIds: string[]) {
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

export function getSpotifyTrackGenres(
  artists: Awaited<ReturnType<typeof getSpotifyArtists>>,
) {
  return unique(artists.flatMap((artist) => artist.genres ?? []).filter(Boolean));
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
  const input = normalizeTrackLookupInput(title, artists);
  const normalizedTitle = normalize(input.matchTitle);
  const normalizedArtists = input.artists.split(",").map(normalize).filter(Boolean);

  return tracks.find((track) => {
    const titleMatches = titleMatchesRequestedTrack(track.name, normalizedTitle);
    const trackArtists = track.artists.map((artist) => normalize(artist.name));
    const artistMatches = normalizedArtists.every((artist) =>
      trackArtists.some((trackArtist) => trackArtist.includes(artist)),
    );

    return titleMatches && artistMatches;
  });
}

function titleMatchesRequestedTrack(
  candidateTitle: string,
  requestedTitle: string,
) {
  const normalizedCandidateTitle = normalize(candidateTitle);

  if (normalizedCandidateTitle === requestedTitle) {
    return true;
  }

  if (!normalizedCandidateTitle.startsWith(`${requestedTitle} `)) {
    return false;
  }

  const suffix = normalizedCandidateTitle.slice(requestedTitle.length).trim();
  return isOfficialVersionSuffix(suffix);
}

function isOfficialVersionSuffix(value: string) {
  if (!value) {
    return false;
  }

  if (/\b(remix|bootleg|flip|vip|rework|mashup)\b/.test(value)) {
    return false;
  }

  return [
    "extended mix",
    "radio edit",
    "original mix",
    "club mix",
    "instrumental",
    "single mix",
  ].some((term) => value.includes(term));
}
