import {
  logProviderSearch,
  normalize,
  parseNumericValue,
} from "../shared/utils.ts";
import {
  createTitleFirstTrackQueries,
  normalizeTrackLookupInput,
  splitArtistNames,
} from "../shared/track-query.ts";

const BEATPORT_WEB_URL = "https://www.beatport.com";
const CRATES_URL = "https://crates.co";
const CRATES_TOKEN_EXPIRY_BUFFER_MS = 60_000;

let cratesBrowseToken: {
  accessToken: string;
  expiresAt: number;
} | null = null;

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
  release?: BeatportReleaseField;
  release_name?: string | null;
  label?: BeatportNamedField | null;
  label_name?: string | null;
  url?: string | null;
  slug?: string | null;
  remixers?: BeatportArtist[];
  is_ugc_remix?: boolean | null;
  is_dj_edit?: boolean | null;
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

type BeatportReleaseField = BeatportNamedField & {
  label?: BeatportNamedField | null;
};

type BeatportGenreField = BeatportNamedField & {
  genre_id?: number;
  genre_name?: string;
};

type BeatportArtist = BeatportNamedField & {
  url?: string | null;
};

type CratesClientCredentialsResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
};

type CratesSearchResponse = {
  tracks?: BeatportTrack[];
  error?: string;
};

export async function searchCratesBeatportTracks(title: string, artists: string) {
  const seenTrackIds = new Set<string>();
  const tracks: BeatportTrack[] = [];
  const accessToken = await getCratesBrowseToken();
  const input = normalizeTrackLookupInput(title, artists);

  for (const query of getBeatportPublicSearchQueries(input.title, input.artists)) {
    const apiParams = new URLSearchParams({
      q: query,
      per_page: "50",
      page: "1",
    });
    const apiCall = `catalog/search/?${apiParams}`;

    logProviderSearch("beatport", "requesting crates search", {
      query,
      url: `${CRATES_URL}/search?${new URLSearchParams({ q: query })}`,
    });

    const response = await fetch(`${CRATES_URL}/oauth_proxy_v4.php`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: `browse_token=${accessToken}`,
        "User-Agent": "track-lab/1.0 (+https://github.com/itaisinai/track-lab)",
      },
      body: new URLSearchParams({
        method: "GET",
        apiCall,
      }),
    });

    if (!response.ok) {
      throw new Error(`Crates search proxy error ${response.status}.`);
    }

    const result = (await response.json()) as CratesSearchResponse;
    if (result.error) {
      throw new Error(`Crates search proxy error: ${result.error}`);
    }

    for (const track of (result.tracks ?? []).filter((track) => !isBeatportRemixTrack(track))) {
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

    if (findBestBeatportMatch(tracks, input.matchTitle, input.artists)) {
      break;
    }
  }

  return tracks;
}

async function getCratesBrowseToken() {
  if (
    cratesBrowseToken &&
    cratesBrowseToken.expiresAt > Date.now() + CRATES_TOKEN_EXPIRY_BUFFER_MS
  ) {
    return cratesBrowseToken.accessToken;
  }

  logProviderSearch("beatport", "requesting crates browse token");
  const response = await fetch(`${CRATES_URL}/oauth_proxy_v4.php`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "track-lab/1.0 (+https://github.com/itaisinai/track-lab)",
    },
    body: new URLSearchParams({ clientCredentials: "1" }),
  });

  if (!response.ok) {
    throw new Error(`Crates browse token error ${response.status}.`);
  }

  const result = (await response.json()) as CratesClientCredentialsResponse;
  if (!result.access_token) {
    throw new Error(result.error ?? "Crates browse token response did not include an access token.");
  }

  cratesBrowseToken = {
    accessToken: result.access_token,
    expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000,
  };

  return cratesBrowseToken.accessToken;
}

export async function searchBeatportPublicTracks(title: string, artists: string) {
  const seenTrackIds = new Set<string>();
  const tracks: BeatportTrack[] = [];
  const input = normalizeTrackLookupInput(title, artists);

  for (const query of getBeatportPublicSearchQueries(input.title, input.artists)) {
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

    for (const track of parseBeatportSearchHtml(await response.text()).filter(
      (track) => !isBeatportRemixTrack(track),
    )) {
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

    if (findBestBeatportMatch(tracks, input.matchTitle, input.artists)) {
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

export function findBestBeatportMatch(
  tracks: BeatportTrack[],
  title: string,
  artists: string,
) {
  const input = normalizeTrackLookupInput(title, artists);
  const normalizedTitle = normalize(input.matchTitle);
  const normalizedArtists = splitArtistNames(input.artists).map(normalize).filter(Boolean);

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
  if (isBeatportRemixTrack(track)) {
    return 0;
  }

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
  return createTitleFirstTrackQueries(title, artists);
}

export function toBeatportSummary(track: BeatportTrack) {
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

export function isBeatportRemixTrack(track: BeatportTrack) {
  if (track.is_ugc_remix || (track.remixers?.length ?? 0) > 0) {
    return true;
  }

  return [track.mix_name, getTrackName(track), getName(track.release) ?? track.release_name]
    .filter((value): value is string => Boolean(value))
    .some(hasRemixMarker);
}

export function getTrackName(track: BeatportTrack) {
  return track.name ?? track.title ?? track.track_name ?? "";
}

export function getArtistNames(track: BeatportTrack) {
  return track.artists
    ?.map((artist) => artist.name ?? artist.artist_name)
    .filter((name): name is string => Boolean(name)) ?? [];
}

export function getName(field: BeatportNamedField | null | undefined) {
  return (
    field?.name ?? field?.artist_name ?? field?.label_name ?? field?.release_name
  );
}

export function getBeatportLabel(track: BeatportTrack) {
  return (
    getName(track.label) ??
    track.label_name ??
    getName(track.release?.label) ??
    null
  );
}

export function getBeatportGenre(track: BeatportTrack, index: number) {
  if (Array.isArray(track.genre)) {
    return track.genre[index]?.genre_name ?? track.genre[index]?.name ?? null;
  }

  if (index === 0) {
    return getName(track.genre) ?? track.genre_name ?? null;
  }

  return getName(track.sub_genre) ?? track.sub_genre_name ?? null;
}

export function getBeatportUrl(track: BeatportTrack) {
  if (track.url && !track.url.includes("api.beatport.com")) {
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

function hasRemixMarker(value: string) {
  return /\b(remix|bootleg|flip|vip|rework)\b/i.test(normalize(value));
}
