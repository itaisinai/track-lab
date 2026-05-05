import { useMutation } from "@tanstack/react-query";
import type {
  EnqueueTrackAnalysisRequest,
  EnqueueTrackAnalysisResponse,
} from "@track-lab/api-types";
import { request } from "../request";
import { apiRoutes } from "../routes";

export function useRunAgentMutation() {
  return useMutation({ mutationFn: enqueueTrackAnalysis });
}

async function enqueueTrackAnalysis(requestBody: EnqueueTrackAnalysisRequest) {
  return request<EnqueueTrackAnalysisResponse>(apiRoutes.agent, {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}
