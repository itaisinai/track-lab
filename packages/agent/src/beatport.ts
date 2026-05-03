import { config } from "./config.ts";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const BEATPORT_TOKEN_URL = "https://api.beatport.com/v4/auth/o/token/";
const BEATPORT_API_URL = "https://api.beatport.com/v4";

type BeatportToken = {
  accessToken: string;
  expiresAt: number;
};

type BeatportTrackResponse = {
  results?: BeatportTrack[];
  count?: number;
  next?: string | null;
  previous?: string | null;
};

type BeatportTrack = {
  id: number;
  name?: string;
  title?: string;
  mix_name?: string | null;
  bpm?: number | string | null;
  key?: BeatportNamedField | null;
  key_name?: string | null;
  genre?: BeatportNamedField | null;
  genre_name?: string | null;
  sub_genre?: BeatportNamedField | null;
  sub_genre_name?: string | null;
  artists?: BeatportArtist[];
  release?: BeatportNamedField & {
    release_date?: string | null;
    publish_date?: string | null;
  };
  release_name?: string | null;
  label?: BeatportNamedField | null;
  label_name?: string | null;
  url?: string | null;
  slug?: string | null;
};

type BeatportNamedField = {
  id?: number;
  name?: string;
  slug?: string;
};

type BeatportArtist = BeatportNamedField & {
  url?: string | null;
};

let cachedToken: BeatportToken | null = null;

export const beatportTrackLookupTool = tool(
  async ({ title, artists }) => {
    if (!config.beatport.clientId || !config.beatport.clientSecret) {
      return JSON.stringify({ 
        found: false,
        source: "beatport",
        bpm: null,
        genre: null,
        key: null,
        url: null,
        error: "Missing BEATPORT_CLIENT_ID or BEATPORT_CLIENT_SECRET.",
      });
    }

    try {
      const token = await getBeatportAccessToken();
      const tracks = await searchBeatportTracks(token, title, artists);
      const match =
        findBestBeatportMatch(tracks, title, artists) ?? tracks[0] ?? null;

      if (!match) {
        return JSON.stringify({
          found: false,
          source: "beatport",
          bpm: null,
          genre: null,
          key: null,
          url: null,
          error: null,
          note: "No matching Beatport track found.",
          candidates: tracks.slice(0, 5).map(toBeatportSummary),
        });
      }

      return JSON.stringify({
        found: true,
        source: "beatport",
        bpm: parseBpm(match.bpm),
        genre: getName(match.genre) ?? match.genre_name ?? null,
        subGenre: getName(match.sub_genre) ?? match.sub_genre_name ?? null,
        key: getName(match.key) ?? match.key_name ?? null,
        url: getBeatportUrl(match),
        track: {
          id: match.id,
          title: getTrackName(match),
          mixName: match.mix_name ?? null,
          artists: getArtistNames(match),
          release: getName(match.release) ?? match.release_name ?? null,
          label: getName(match.label) ?? match.label_name ?? null,
        },
        error: null,
        candidates: tracks.slice(0, 5).map(toBeatportSummary),
      });
    } catch (error) {
      return JSON.stringify({
        found: false,
        source: "beatport",
        bpm: null,
        genre: null,
        key: null,
        url: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
  {
    name: "lookup_beatport_track",
    description:
      "Search Beatport catalog tracks by title and artist. Returns EDM-focused metadata including BPM, genre, subgenre, key, label, release, and URL when available.",
    schema: z.object({
      title: z.string().describe("The track title to search for."),
      artists: z.string().describe("Comma-separated artist names."),
    }),
  },
);

async function getBeatportAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const clientId = config.beatport.clientId;
  const clientSecret = config.beatport.clientSecret;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Beatport credentials.");
  }

  const response = await fetch(BEATPORT_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });
  const data = await parseBeatportResponse<{
    access_token: string;
    expires_in: number;
  }>(response, "token");

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.accessToken;
}

async function searchBeatportTracks(
  token: string,
  title: string,
  artists: string,
) {
  const params = new URLSearchParams({
    name: title,
    artist_name: artists.split(",")[0]?.trim() ?? artists.trim(),
    per_page: "10",
    page: "1",
  });
  const response = await beatportFetch(token, `/catalog/tracks/?${params}`);
  const data = await parseBeatportResponse<BeatportTrackResponse>(
    response,
    "tracks",
  );

  return data.results ?? [];
}

async function beatportFetch(token: string, path: string) {
  return fetch(`${BEATPORT_API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function parseBeatportResponse<T>(response: Response, step: string) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `Beatport ${step} API error ${response.status}: ${JSON.stringify(data)}`,
    );
  }

  return data as T;
}

function findBestBeatportMatch(
  tracks: BeatportTrack[],
  title: string,
  artists: string,
) {
  const normalizedTitle = normalize(title);
  const normalizedArtists = artists.split(",").map(normalize).filter(Boolean);

  return tracks.find((track) => {
    const titleMatches = normalize(getTrackName(track)) === normalizedTitle;
    const trackArtists = getArtistNames(track).map(normalize);
    const artistMatches = normalizedArtists.every((artist) =>
      trackArtists.some((trackArtist) => trackArtist.includes(artist)),
    );

    return titleMatches && artistMatches;
  });
}

function toBeatportSummary(track: BeatportTrack) {
  return {
    id: track.id,
    title: getTrackName(track),
    artists: getArtistNames(track),
    bpm: parseBpm(track.bpm),
    genre: getName(track.genre) ?? track.genre_name ?? null,
    subGenre: getName(track.sub_genre) ?? track.sub_genre_name ?? null,
    key: getName(track.key) ?? track.key_name ?? null,
    url: getBeatportUrl(track),
  };
}

function getTrackName(track: BeatportTrack) {
  return track.name ?? track.title ?? "";
}

function getArtistNames(track: BeatportTrack) {
  return (
    track.artists?.
      map((artist) => artist.name)
      .filter((name): name is string => Boolean(name)) ?? []
  );
}

function getName(field: BeatportNamedField | null | undefined) {
  return field?.name;
}

function getBeatportUrl(track: BeatportTrack) {
  if (track.url) {
    return track.url;
  }

  if (track.slug) {
    return `https://www.beatport.com/track/${track.slug}/${track.id}`;
  }

  return `https://www.beatport.com/track/${track.id}`;
}

function parseBpm(bpm: BeatportTrack["bpm"]) {
  if (typeof bpm === "number") {
    return bpm;
  }

  if (typeof bpm === "string") {
    const parsed = Number.parseInt(bpm, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
