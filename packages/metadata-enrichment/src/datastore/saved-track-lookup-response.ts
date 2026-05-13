import type { TrackResult } from "@track-lab/datastore";

export type SavedTrackLookupResponse =
  | {
      found: false;
      source: "datastore";
      result: null;
    }
  | {
      found: true;
      source: "datastore";
      result: {
        title: string;
        artists: string;
        album: string | null;
        status: TrackResult["status"];
        providersUsed: TrackResult["providersUsed"];
        errors: TrackResult["errors"];
        json: unknown;
        rawResponse: string;
        updatedAt: string;
      };
    };

export function createSavedTrackLookupResponse(
  result: TrackResult | null,
): SavedTrackLookupResponse {
  if (!result) {
    return {
      found: false,
      source: "datastore",
      result: null,
    };
  }

  return {
    found: true,
    source: "datastore",
    result: {
      title: result.title,
      artists: result.artists,
      album: result.album,
      status: result.status,
      providersUsed: result.providersUsed,
      errors: result.errors,
      json: result.json,
      rawResponse: result.rawResponse,
      updatedAt: result.updatedAt,
    },
  };
}
