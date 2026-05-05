import { useMutation } from "@tanstack/react-query";
import { request } from "../request";
import { apiRoutes } from "../routes";
import type { TrackAnalysisJob } from "../../types";

export function useResolveTrackAnalysisJobMutation() {
  return useMutation({ mutationFn: resolveTrackAnalysisJob });
}

async function resolveTrackAnalysisJob(id: number) {
  const data = await request<{ job: TrackAnalysisJob }>(
    apiRoutes.resolveTrackAnalysisJob(id),
    { method: "POST" },
  );
  return data.job;
}
