type GenreNormalizationInput = {
  source: string;
  genre: string | null | undefined;
  subGenre: string | null | undefined;
};

type GenreNormalizationResult = {
  genre: string | null;
  subGenre: string | null;
};

const BEATPORT_GENERIC_GENRES = new Set([
  "mainstage",
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
    BEATPORT_GENERIC_GENRES.has(cleanedGenre)
  ) {
    return {
      genre: "Electronic",
      subGenre: cleanedSubGenre,
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
