import type { ProviderTrackLookupResult, TrackLookupInput } from "./types.ts";
import { logProviderSearch, normalize, parseNumericValue } from "./utils.ts";

import { config } from "../config.ts";

const BEATPORT_TOKEN_URL = "https://api.beatport.com/v4/auth/o/token/";
const BEATPORT_API_URL = "https://api.beatport.com/v4";
const BEATPORT_WEB_URL = "https://www.beatport.com";

type BeatportToken = {
  accessToken: string;
  expiresAt: number;
};

type BeatportTrackResponse = {
  results?: BeatportTrack[];
};

export type BeatportTrack = {
  id?: number;
  name?: string;
  title?: string;
  mix_name?: string | null;
  bpm?: number | string | null;
  key?: BeatportNamedField | null;
  key_name?: string | null;
  genre?: BeatportNamedField | BeatportGenreField[] | null;
  genre_name?: string | null;
  sub_genre?: BeatportNamedField | null;
  sub_genre_name?: string | null;
  artists?: BeatportArtist[];
  release?: BeatportNamedField;
  release_name?: string | null;
  label?: BeatportNamedField | null;
  label_name?: string | null;
  url?: string | null;
  slug?: string | null;
  track_id?: number;
  track_name?: string;
  release_slug?: string | null;
};

type BeatportNamedField = {
  id?: number;
  name?: string;
  slug?: string;
  artist_name?: string;
  label_name?: string;
  release_name?: string;
};

type BeatportGenreField = BeatportNamedField & {
  genre_id?: number;
  genre_name?: string;
};

type BeatportArtist = BeatportNamedField & {
  url?: string | null;
};

let cachedToken: BeatportToken | null = null;

export async function lookupBeatportTrack({
  title,
  artists,
}: TrackLookupInput): Promise<ProviderTrackLookupResult> {
  logProviderSearch("beatport", "search started", { title, artists });

  try {
    if (!config.beatport.clientId || !config.beatport.clientSecret) {
      logProviderSearch("beatport", "using public search page fallback");
      return await lookupBeatportPublicSearch(title, artists);
    }

    const token = await getBeatportAccessToken();
    const tracks = await searchBeatportTracks(token, title, artists);
    const match =
      findBestBeatportMatch(tracks, title, artists) ?? tracks[0] ?? null;
    logProviderSearch("beatport", "api search results", {
      candidates: tracks.length,
      selected: match ? getTrackName(match) : null,
    });

    if (!match) {
      logProviderSearch("beatport", "no match", { title, artists });
      return {
        found: false,
        source: "beatport",
        bpm: null,
        genre: null,
        key: null,
        url: null,
        error: null,
        note: "No matching Beatport track found.",
        candidates: tracks.slice(0, 5).map(toBeatportSummary),
      };
    }

    logProviderSearch("beatport", "matched track", toBeatportSummary(match));

    return {
      found: true,
      source: "beatport",
      bpm: parseNumericValue(match.bpm),
      genre: getBeatportGenre(match, 0),
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
    };
  } catch (error) {
    logProviderSearch("beatport", "search failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      found: false,
      source: "beatport",
      bpm: null,
      genre: null,
      key: null,
      url: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function lookupBeatportPublicSearch(title: string, artists: string) {
  const tracks = await searchBeatportPublicTracks(title, artists);
  const match = findBestBeatportMatch(tracks, title, artists) ?? null;
  logProviderSearch("beatport", "public search results", {
    candidates: tracks.length,
    selected: match ? getTrackName(match) : null,
  });

  if (!match) {
    logProviderSearch("beatport", "no match", { title, artists });
    return {
      found: false,
      source: "beatport",
      bpm: null,
      genre: null,
      key: null,
      url: null,
      error: null,
      note: "No matching Beatport track found.",
      candidates: [],
    };
  }

  logProviderSearch("beatport", "matched public track", toBeatportSummary(match));

  return {
    found: true,
    source: "beatport",
    bpm: parseNumericValue(match.bpm),
    genre: getBeatportGenre(match, 0),
    subGenre: getBeatportGenre(match, 1),
    key: match.key_name ?? getName(match.key) ?? null,
    url: getBeatportUrl(match),
    track: {
      id: match.id ?? match.track_id,
      title: getTrackName(match),
      mixName: match.mix_name ?? null,
      artists: getArtistNames(match),
      release: getName(match.release) ?? match.release_name ?? null,
      label: getName(match.label) ?? match.label_name ?? null,
    },
    error: null,
    candidates: tracks.slice(0, 5).map(toBeatportSummary),
  };
}

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

async function searchBeatportPublicTracks(title: string, artists: string) {
  const seenTrackIds = new Set<string>();
  const tracks: BeatportTrack[] = [];

  for (const query of getBeatportPublicSearchQueries(title, artists)) {
    const params = new URLSearchParams({ q: query });
    logProviderSearch("beatport", "requesting public search", {
      query,
      url: `${BEATPORT_WEB_URL}/search?${params}`,
    });
    const response = await fetch(`${BEATPORT_WEB_URL}/search?${params}`, {
      headers: {
        Accept: "text/html",
        "User-Agent": "track-lab/1.0 (+https://github.com/itaisinai/track-lab)",
      },
    });

    if (!response.ok) {
      throw new Error(`Beatport search page error ${response.status}.`);
    }

    for (const track of parseBeatportSearchHtml(await response.text())) {
      const id = String(
        track.id ??
          track.track_id ??
          `${getTrackName(track)}:${getArtistNames(track).join(",")}`,
      );
      if (seenTrackIds.has(id)) {
        continue;
      }

      seenTrackIds.add(id);
      tracks.push(track);
    }

    if (findBestBeatportMatch(tracks, title, artists)) {
      break;
    }
  }

  return tracks;
}

export function parseBeatportSearchHtml(html: string): BeatportTrack[] {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );

  if (!match) {
    return [];
  }

  const nextData = JSON.parse(match[1]) as {
    props?: {
      pageProps?: {
        dehydratedState?: {
          queries?: Array<{
            state?: {
              data?: {
                tracks?: {
                  data?: BeatportTrack[];
                };
              };
            };
          }>;
        };
      };
    };
  };

  return (
    nextData.props?.pageProps?.dehydratedState?.queries?.find((query) =>
      Array.isArray(query.state?.data?.tracks?.data),
    )?.state?.data?.tracks?.data ?? []
  );
}

function beatportFetch(token: string, path: string) {
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
  const normalizedArtists = splitArtistNames(artists).map(normalize).filter(Boolean);

  return tracks
    .map((track) => ({
      track,
      score: scoreBeatportMatch(track, normalizedTitle, normalizedArtists),
    }))
    .filter((match) => match.score >= 3)
    .sort((a, b) => b.score - a.score)[0]?.track ?? null;
}

function scoreBeatportMatch(
  track: BeatportTrack,
  normalizedTitle: string,
  normalizedArtists: string[],
) {
  const trackTitle = normalize(getTrackName(track));
  const titleMatches =
    trackTitle === normalizedTitle ||
    trackTitle.startsWith(`${normalizedTitle} `) ||
    trackTitle.endsWith(` ${normalizedTitle}`) ||
    trackTitle.includes(` ${normalizedTitle} `);

  if (!titleMatches) {
    return 0;
  }

  const trackArtists = getArtistNames(track).map(normalize);
  const artistMatchCount = normalizedArtists.filter((artist) =>
    trackArtists.some((trackArtist) =>
      trackArtist.includes(artist) || artist.includes(trackArtist),
    ),
  ).length;

  if (normalizedArtists.length > 0 && artistMatchCount === 0) {
    return 0;
  }

  return 2 + artistMatchCount;
}

function getBeatportPublicSearchQueries(title: string, artists: string) {
  const artistList = splitArtistNames(artists);
  const queries = [
    [artists, title].filter(Boolean).join(" "),
    ...artistList.slice(0, 3).map((artist) => `${artist} ${title}`),
    title,
  ];

  return [...new Set(queries.map((query) => query.trim()).filter(Boolean))];
}

function splitArtistNames(artists: string) {
  return artists
    .split(",")
    .map((artist) => artist.trim())
    .filter(Boolean);
}

function toBeatportSummary(track: BeatportTrack) {
  return {
    id: track.id ?? track.track_id,
    title: getTrackName(track),
    artists: getArtistNames(track),
    bpm: parseNumericValue(track.bpm),
    genre: getBeatportGenre(track, 0),
    subGenre: getBeatportGenre(track, 1),
    key: getName(track.key) ?? track.key_name ?? null,
    url: getBeatportUrl(track),
  };
}

function getTrackName(track: BeatportTrack) {
  return track.name ?? track.title ?? track.track_name ?? "";
}

function getArtistNames(track: BeatportTrack) {
  return track.artists
    ?.map((artist) => artist.name ?? artist.artist_name)
    .filter((name): name is string => Boolean(name)) ?? [];
}

function getName(field: BeatportNamedField | null | undefined) {
  return (
    field?.name ?? field?.artist_name ?? field?.label_name ?? field?.release_name
  );
}

function getBeatportGenre(track: BeatportTrack, index: number) {
  if (Array.isArray(track.genre)) {
    return track.genre[index]?.genre_name ?? track.genre[index]?.name ?? null;
  }

  if (index === 0) {
    return getName(track.genre) ?? track.genre_name ?? null;
  }

  return getName(track.sub_genre) ?? track.sub_genre_name ?? null;
}

function getBeatportUrl(track: BeatportTrack) {
  if (track.url) {
    return track.url.startsWith("http")
      ? track.url
      : `${BEATPORT_WEB_URL}${track.url}`;
  }

  if (track.slug) {
    return `${BEATPORT_WEB_URL}/track/${track.slug}/${track.id ?? track.track_id}`;
  }

  const id = track.id ?? track.track_id;
  if (!id) {
    return null;
  }

  const generatedSlug = slugify([getTrackName(track), track.mix_name]
    .filter(Boolean)
    .join(" "));

  return `${BEATPORT_WEB_URL}/track/${generatedSlug || "track"}/${id}`;
}

function slugify(value: string) {
  return normalize(value).replace(/\s+/g, "-");
}
