import { useMutation } from "@tanstack/react-query";
import { request } from "../request";
import { apiRoutes } from "../routes";
import type { TrackAnalysisJob } from "../../types";

export function useRetryTrackAnalysisJobMutation() {
  return useMutation({ mutationFn: retryTrackAnalysisJob });
}

async function retryTrackAnalysisJob(id: number) {
  const data = await request<{ job: TrackAnalysisJob }>(
    apiRoutes.retryTrackAnalysisJob(id),
    { method: "POST" },
  );
  return data.job;
}
