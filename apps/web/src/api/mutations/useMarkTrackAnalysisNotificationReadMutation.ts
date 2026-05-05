import { useMutation } from "@tanstack/react-query";
import { request } from "../request";
import { apiRoutes } from "../routes";
import type { TrackAnalysisJob } from "../../types";

export function useMarkTrackAnalysisNotificationReadMutation() {
  return useMutation({ mutationFn: markTrackAnalysisNotificationRead });
}

async function markTrackAnalysisNotificationRead(id: number) {
  const data = await request<{ job: TrackAnalysisJob }>(
    apiRoutes.markTrackAnalysisNotificationRead(id),
    { method: "POST" },
  );
  return data.job;
}
