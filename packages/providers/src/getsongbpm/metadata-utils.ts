import { normalize } from "../shared/utils.ts";

const GETSONGBPM_API_URL = "https://api.getsong.co";

export type GetSongBpmSearchResponse = {
  search?: unknown;
};

export type GetSongBpmTrack = {
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

export function getSongBpmApiKey() {
  return process.env.GETSONGBPM_API_KEY ?? null;
}

export async function searchGetSongBpmTrack(
  apiKey: string,
  title: string,
  artists: string,
) {
  const lookup = `song:${title} artist:${artists}`;
  const search = await getSongBpmFetch<GetSongBpmSearchResponse>("/search/", {
    api_key: apiKey,
    type: "both",
    lookup,
    limit: "10",
  });
  const tracks = normalizeTracks(search.search);

  return {
    lookup,
    tracks,
    match: findBestTrackMatch(tracks, title, artists) ?? tracks[0] ?? null,
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

export function toGetSongBpmTrackSummary(track: GetSongBpmTrack) {
  const artist = firstGetSongBpmArtist(track.artist);

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
    const trackArtist = firstGetSongBpmArtist(track.artist);
    const normalizedTrackArtist = normalize(trackArtist?.name ?? "");
    const artistMatches = normalizedArtists.some((artist) =>
      normalizedTrackArtist.includes(artist),
    );

    return titleMatches && artistMatches;
  });
}

export function firstGetSongBpmArtist(artist: GetSongBpmTrack["artist"]) {
  return Array.isArray(artist) ? artist[0] : artist;
}
