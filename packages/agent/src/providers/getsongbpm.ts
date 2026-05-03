import { config } from "../config.ts";
import type { ProviderTrackLookupResult, TrackLookupInput } from "./types.ts";
import { normalize, parseNumericValue } from "./utils.ts";

const GETSONGBPM_API_URL = "https://api.getsong.co";

type GetSongBpmSearchResponse = {
  search?: unknown;
};

type GetSongBpmTrack = {
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
};

export async function lookupGetSongBpmTrack({
  title,
  artists,
}: TrackLookupInput): Promise<ProviderTrackLookupResult> {
  const apiKey = config.getSongBpm.apiKey;

  if (!apiKey) {
    return {
      found: false,
      source: "getsongbpm",
      bpm: null,
      genre: null,
      genres: [],
      url: null,
      error: "Missing GETSONGBPM_API_KEY environment variable.",
    };
  }

  let search: GetSongBpmSearchResponse;

  try {
    search = await getSongBpmFetch<GetSongBpmSearchResponse>("/search/", {
      api_key: apiKey,
      type: "both",
      lookup: `song:${title} artist:${artists}`,
      limit: "10",
    });
  } catch (error) {
    return {
      found: false,
      source: "getsongbpm",
      bpm: null,
      genre: null,
      genres: [],
      url: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const tracks = normalizeTracks(search.search);
  const match = findBestTrackMatch(tracks, title, artists) ?? tracks[0] ?? null;

  if (!match) {
    return {
      found: false,
      source: "getsongbpm",
      bpm: null,
      genre: null,
      genres: [],
      url: null,
      error: null,
      note: "No matching GetSongBPM track found.",
      candidates: tracks.slice(0, 5).map(toTrackSummary),
    };
  }

  const artist = firstArtist(match.artist);

  return {
    found: true,
    source: "getsongbpm",
    bpm: parseNumericValue(match.tempo),
    genre: artist?.genres?.[0] ?? null,
    genres: artist?.genres ?? [],
    key: match.key_of ?? null,
    url: match.uri ?? null,
    error: null,
    track: {
      id: match.id,
      title: match.title,
      uri: match.uri ?? null,
      artist: artist?.name ?? null,
      album: match.album?.title ?? null,
      albumYear: match.album?.year ?? null,
      timeSignature: match.time_sig ?? null,
      key: match.key_of ?? null,
      openKey: match.open_key ?? null,
      danceability: match.danceability ?? null,
      acousticness: match.acousticness ?? null,
    },
    candidates: tracks.slice(0, 5).map(toTrackSummary),
  };
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

function toTrackSummary(track: GetSongBpmTrack) {
  const artist = firstArtist(track.artist);

  return {
    id: track.id,
    title: track.title,
    artist: artist?.name ?? null,
    tempo: track.tempo ?? null,
    uri: track.uri ?? null,
  };
}

function normalizeTracks(value: unknown): GetSongBpmTrack[] {
  if (Array.isArray(value)) {
    return value.filter(isTrack);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;

  if (isTrack(record)) {
    return [record];
  }

  if (Array.isArray(record.track)) {
    return record.track.filter(isTrack);
  }

  if (isTrack(record.track)) {
    return [record.track];
  }

  if (Array.isArray(record.song)) {
    return record.song.filter(isTrack);
  }

  if (isTrack(record.song)) {
    return [record.song];
  }

  return Object.values(record).filter(isTrack);
}

function isTrack(value: unknown): value is GetSongBpmTrack {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "title" in value,
  );
}

function findBestTrackMatch(
  tracks: GetSongBpmTrack[],
  title: string,
  artists: string,
) {
  const normalizedTitle = normalize(title);
  const normalizedArtists = artists.split(",").map(normalize).filter(Boolean);

  return tracks.find((track) => {
    const titleMatches = normalize(track.title) === normalizedTitle;
    const trackArtist = firstArtist(track.artist);
    const normalizedTrackArtist = normalize(trackArtist?.name ?? "");
    const artistMatches = normalizedArtists.some((artist) =>
      normalizedTrackArtist.includes(artist),
    );

    return titleMatches && artistMatches;
  });
}

function firstArtist(artist: GetSongBpmTrack["artist"]) {
  return Array.isArray(artist) ? artist[0] : artist;
}
