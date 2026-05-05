import { useMutation } from "@tanstack/react-query";
import { request } from "../request";
import { apiRoutes } from "../routes";
import type { SavedTrackResult } from "../../types";

export function useSaveAgentResponseMutation() {
  return useMutation({ mutationFn: saveAgentResponse });
}

async function saveAgentResponse(agentResponse: unknown) {
  const data = await request<{ result: SavedTrackResult }>(apiRoutes.results, {
    method: "POST",
    body: JSON.stringify({ agentResponse }),
  });

  return data.result;
}
