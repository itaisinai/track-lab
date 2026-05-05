import { useMutation } from "@tanstack/react-query";
import { request } from "../request";
import { apiRoutes } from "../routes";
import type { TrackAnalysisJob } from "../../types";

export function useReenrichSavedResultMutation() {
  return useMutation({ mutationFn: reenrichSavedResult });
}

async function reenrichSavedResult(id: number) {
  return request<{ job: Pick<TrackAnalysisJob, "id" | "status"> }>(
    apiRoutes.enrichResult(id),
    { method: "POST" },
  );
}
