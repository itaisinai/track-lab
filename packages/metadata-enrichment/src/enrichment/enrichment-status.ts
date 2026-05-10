import type { EnrichedTrackMetadata } from "./types.ts";

export function getEnrichmentStatus(
  bpm: number | null,
  genre: string | null,
): EnrichedTrackMetadata["status"] {
  if (bpm && genre) {
    return "complete";
  }

  if (bpm || genre) {
    return "partial";
  }

  return "missing";
}
