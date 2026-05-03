import { normalizeRekordboxValue } from "./rekordbox-normalization.ts";
import type { RekordboxTrackMetadata } from "./types.ts";

export function findRekordboxTrack(
  tracks: RekordboxTrackMetadata[],
  trackName: string,
  artist?: string,
) {
  const normalizedTrackName = normalizeRekordboxValue(trackName);
  const normalizedArtist = artist ? normalizeRekordboxValue(artist) : null;

  return (
    tracks.find((track) => {
      const titleMatches =
        normalizeRekordboxValue(track.trackName) === normalizedTrackName;

      if (!titleMatches) {
        return false;
      }

      if (!normalizedArtist) {
        return true;
      }

      return normalizeRekordboxValue(track.artist ?? "").includes(
        normalizedArtist,
      );
    }) ?? null
  );
}
