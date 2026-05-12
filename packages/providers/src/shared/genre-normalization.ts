type GenreNormalizationInput = {
  source: string;
  genre: string | null | undefined;
  subGenre: string | null | undefined;
};

type GenreNormalizationResult = {
  genre: string | null;
  subGenre: string | null;
};

const BEATPORT_NON_GENRE_BUCKETS = new Set([
  "mainstage",
]);

const SUBGENRE_PARENT_GENRES = new Map([
  ["speed house", "Electronic"],
  ["drum & bass", "Electronic"],
  ["drum and bass", "Electronic"],
  ["dubstep", "Electronic"],
  ["bass house", "House"],
  ["tech house", "House"],
  ["melodic house", "House"],
  ["melodic techno", "Techno"],
]);

export function normalizeProviderGenre({
  source,
  genre,
  subGenre,
}: GenreNormalizationInput): GenreNormalizationResult {
  const cleanedGenre = normalizeGenreString(genre);
  const cleanedSubGenre = normalizeGenreString(subGenre);

  if (
    source === "beatport" &&
    cleanedGenre &&
    BEATPORT_NON_GENRE_BUCKETS.has(cleanedGenre) &&
    cleanedSubGenre
  ) {
    return {
      genre: inferParentGenre(cleanedSubGenre) ?? genre ?? null,
      subGenre: subGenre ?? null,
    };
  }

  return {
    genre: genre ?? null,
    subGenre: subGenre ?? null,
  };
}

function normalizeGenreString(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

function inferParentGenre(subGenre: string) {
  return SUBGENRE_PARENT_GENRES.get(subGenre) ?? null;
}
