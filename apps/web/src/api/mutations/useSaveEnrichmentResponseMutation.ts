import { useMutation } from "@tanstack/react-query";
import { request } from "../request";
import { apiRoutes } from "../routes";
import type { SavedTrackResult } from "../../types";

export function useSaveEnrichmentResponseMutation() {
  return useMutation({ mutationFn: saveEnrichmentResponse });
}

async function saveEnrichmentResponse(enrichmentResponse: unknown) {
  const data = await request<{ result: SavedTrackResult }>(apiRoutes.results, {
    method: "POST",
    body: JSON.stringify({ enrichmentResponse }),
  });

  return data.result;
}
