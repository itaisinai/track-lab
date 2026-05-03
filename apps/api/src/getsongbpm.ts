import { tool } from "langchain";
import { z } from "zod";

const GETSONGBPM_API_URL = "https://api.getsong.co";

type GetSongBpmSearchResponse = {
  search?: GetSongBpmSong[];
};

type GetSongBpmSongResponse = {
  song?: GetSongBpmSong;
};

type GetSongBpmSong = {
  id: string;
  title: string;
  uri?: string;
  tempo?: string | number;
  time_sig?: string;
  key_of?: string;
  open_key?: string;
  danceability?: number;
  acousticness?: number;
  artist?: GetSongBpmArtist | GetSongBpmArtist[];
  album?: {
    title?: string;
    uri?: string;
    year?: number;
  };
};

type GetSongBpmArtist = {
  id?: string;
  name?: string;
  uri?: string;
  genres?: string[];
  from?: string;
  mbid?: string;
};

export const getSongBpmLookupTool = tool(
  async ({ title, artists }) => {
    const apiKey = process.env.GETSONGBPM_API_KEY;

    if (!apiKey) {
      throw new Error("Missing GETSONGBPM_API_KEY environment variable.");
    }

    const search = await getSongBpmFetch<GetSongBpmSearchResponse>("/search/", {
      api_key: apiKey,
      type: "both",
      lookup: `song:${title} artist:${artists}`,
      limit: "10",
    });
    const songs = search.search ?? [];
    const match = findBestSongMatch(songs, title, artists) ?? songs[0] ?? null;

    if (!match) {
      return JSON.stringify({
        found: false,
        source: "getsongbpm",
        bpm: null,
        genre: null,
        genres: [],
        url: null,
        note: "No matching GetSongBPM song found.",
      });
    }

    const song = await getSongDetails(apiKey, match.id);
    const artist = firstArtist(song.artist);

    return JSON.stringify({
      found: true,
      source: "getsongbpm",
      bpm: parseTempo(song.tempo),
      genre: artist?.genres?.[0] ?? null,
      genres: artist?.genres ?? [],
      url: song.uri ?? null,
      song: {
        id: song.id,
        title: song.title,
        uri: song.uri ?? null,
        artist: artist?.name ?? null,
        album: song.album?.title ?? null,
        albumYear: song.album?.year ?? null,
        timeSignature: song.time_sig ?? null,
        key: song.key_of ?? null,
        openKey: song.open_key ?? null,
        danceability: song.danceability ?? null,
        acousticness: song.acousticness ?? null,
      },
    });
  },
  {
    name: "lookup_getsongbpm_track",
    description:
      "Look up BPM/tempo and related song metadata from GetSongBPM by track title and artists.",
    schema: z.object({
      title: z.string().describe("The track title to search for."),
      artists: z.string().describe("Comma-separated artist names."),
    }),
  },
);

async function getSongDetails(apiKey: string, id: string) {
  const response = await getSongBpmFetch<GetSongBpmSongResponse>("/song/", {
    api_key: apiKey,
    id,
  });

  if (!response.song) {
    throw new Error(`GetSongBPM song details not found for id ${id}.`);
  }

  return response.song;
}

async function getSongBpmFetch<T>(
  path: string,
  params: Record<string, string>,
) {
  const url = new URL(path, GETSONGBPM_API_URL);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url, {
    headers: {
      "X-API-KEY": params.api_key,
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `GetSongBPM API error ${response.status}: ${JSON.stringify(data)}`,
    );
  }

  return data as T;
}

function findBestSongMatch(
  songs: GetSongBpmSong[],
  title: string,
  artists: string,
) {
  const normalizedTitle = normalize(title);
  const normalizedArtists = artists.split(",").map(normalize).filter(Boolean);

  return songs.find((song) => {
    const titleMatches = normalize(song.title) === normalizedTitle;
    const songArtist = firstArtist(song.artist);
    const normalizedSongArtist = normalize(songArtist?.name ?? "");
    const artistMatches = normalizedArtists.some((artist) =>
      normalizedSongArtist.includes(artist),
    );

    return titleMatches && artistMatches;
  });
}

function firstArtist(artist: GetSongBpmSong["artist"]) {
  return Array.isArray(artist) ? artist[0] : artist;
}

function parseTempo(tempo: GetSongBpmSong["tempo"]) {
  if (typeof tempo === "number") {
    return tempo;
  }

  if (typeof tempo === "string") {
    const parsed = Number.parseInt(tempo, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
