import { normalize, unique } from "./utils.ts";

const DASH_VARIANTS = /[\u2010-\u2015\u2212]/g;
const SIMPLE_DASH_SEPARATOR = /\s+-\s+/;

export type NormalizedTrackLookupInput = {
  title: string;
  matchTitle: string;
  artists: string;
  primaryArtist: string;
  titleHasArtistPrefix: boolean;
};

export function normalizeTrackLookupInput(
  title: string,
  artists: string,
): NormalizedTrackLookupInput {
  const normalizedTitle = normalizeSearchText(title);
  const normalizedArtists = normalizeSearchText(artists);
  const artistList = splitArtistNames(normalizedArtists);
  const primaryArtist = artistList[0] ?? normalizedArtists;
  const splitTitle =
    splitArtistPrefixedTitle(normalizedTitle, artistList) ??
    splitArtistSuffixedTitle(normalizedTitle, artistList);

  return {
    title: normalizedTitle,
    matchTitle: splitTitle ?? normalizedTitle,
    artists: normalizedArtists,
    primaryArtist,
    titleHasArtistPrefix: Boolean(splitTitle),
  };
}

export function createTitleFirstTrackQueries(title: string, artists: string) {
  const input = normalizeTrackLookupInput(title, artists);
  const queries = input.titleHasArtistPrefix
    ? [
        input.title,
        input.title.replace(SIMPLE_DASH_SEPARATOR, " "),
        input.matchTitle,
      ]
    : [
        [input.title, input.primaryArtist].filter(Boolean).join(" "),
        input.title,
        `${input.title} original`,
      ];

  return unique(queries.map(normalizeSearchText).filter(Boolean));
}

export function createTitleFirstTrackQueriesWithArtistVariants(
  title: string,
  artists: string,
) {
  const input = normalizeTrackLookupInput(title, artists);
  const queries = new Set(createTitleFirstTrackQueries(title, artists));

  for (const artist of splitArtistNames(input.artists)) {
    const query = normalizeSearchText(
      [input.matchTitle, artist].filter(Boolean).join(" "),
    );

    if (query) {
      queries.add(query);
    }
  }

  return unique([...queries]);
}

export function splitArtistNames(artists: string) {
  return normalizeSearchText(artists)
    .split(",")
    .map((artist) => artist.trim())
    .filter(Boolean);
}

export function normalizeSearchText(value: string) {
  return value.replace(DASH_VARIANTS, "-").replace(/\s+/g, " ").trim();
}

function splitArtistPrefixedTitle(title: string, artists: string[]) {
  const parts = title.split(SIMPLE_DASH_SEPARATOR);
  if (parts.length < 2) {
    return null;
  }

  const maybeArtist = parts[0]?.trim();
  const maybeTitle = parts.slice(1).join(" - ").trim();

  if (!maybeArtist || !maybeTitle) {
    return null;
  }

  const normalizedMaybeArtist = normalize(maybeArtist);
  const duplicatesKnownArtist = artists.some((artist) => {
    const normalizedArtist = normalize(artist);
    return (
      normalizedMaybeArtist === normalizedArtist ||
      normalizedMaybeArtist.includes(normalizedArtist) ||
      normalizedArtist.includes(normalizedMaybeArtist)
    );
  });

  return duplicatesKnownArtist ? maybeTitle : null;
}

function splitArtistSuffixedTitle(title: string, artists: string[]) {
  const parts = title.split(SIMPLE_DASH_SEPARATOR);
  if (parts.length < 2) {
    return null;
  }

  const maybeArtist = parts.at(-1)?.trim();
  const maybeTitle = parts.slice(0, -1).join(" - ").trim();

  if (!maybeArtist || !maybeTitle) {
    return null;
  }

  const normalizedMaybeArtist = normalize(maybeArtist);
  const matchesKnownArtist = artists.some((artist) => {
    const normalizedArtist = normalize(artist);
    return (
      normalizedMaybeArtist === normalizedArtist ||
      normalizedMaybeArtist.includes(normalizedArtist) ||
      normalizedArtist.includes(normalizedMaybeArtist)
    );
  });

  return matchesKnownArtist ? maybeTitle : null;
}
