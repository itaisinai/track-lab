import type { NormalizedRemixSearchRequest } from "./types.ts";

const REMIX_TERMS = ["remix", "edit", "flip", "bootleg", "vip", "rework"];

export function createRemixSearchQueries({
  title,
  artists,
  genre,
}: NormalizedRemixSearchRequest) {
  const primaryArtist = artists.split(",")[0]?.trim() || artists;
  const artistVariants = Array.from(
    new Set([artists, primaryArtist].filter(Boolean)),
  );
  const queries = new Set<string>();

  for (const artist of artistVariants) {
    for (const term of REMIX_TERMS) {
      queries.add(compactQuery([artist, title, term]));
    }
  }

  if (genre) {
    for (const artist of artistVariants) {
      queries.add(compactQuery([artist, title, genre]));
      queries.add(compactQuery([artist, title, genre, "remix"]));
    }
    queries.add(compactQuery([title, genre, "remix"]));
  }

  queries.add(compactQuery([artists, title]));
  queries.add(compactQuery([primaryArtist, title]));

  return Array.from(queries).slice(0, 18);
}

function compactQuery(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
}
