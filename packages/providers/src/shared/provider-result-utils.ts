import type { ProviderTrackLookupResult } from "./types.ts";

export function hasUsefulTrackLookupResult(result: ProviderTrackLookupResult) {
  return Boolean(
    result.found ||
      result.bpm ||
      result.genre ||
      result.key ||
      result.subGenre ||
      result.genres?.length ||
      result.url ||
      result.track,
  );
}

export function getTrackString(track: unknown, key: string) {
  if (!isTrackRecord(track)) {
    return null;
  }

  const value = track[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getTrackArtists(track: unknown) {
  if (!isTrackRecord(track)) {
    return null;
  }

  const value = track.artists;

  if (Array.isArray(value)) {
    const artists = value.filter(
      (artist): artist is string =>
        typeof artist === "string" && artist.trim().length > 0,
    );
    return artists.length > 0 ? artists.join(", ") : null;
  }

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isTrackRecord(track: unknown): track is Record<string, unknown> {
  return Boolean(track && typeof track === "object" && !Array.isArray(track));
}
