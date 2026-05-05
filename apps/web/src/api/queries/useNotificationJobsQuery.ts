import { useQuery } from "@tanstack/react-query";
import { request } from "../request";
import { apiRoutes } from "../routes";
import type { TrackAnalysisJob } from "../../types";
import { queryKeys } from "./queryKeys";

export function useNotificationJobsQuery() {
  return useQuery({
    queryKey: queryKeys.notificationJobs,
    queryFn: listNotificationJobs,
    refetchInterval: 7000,
  });
}

async function listNotificationJobs() {
  const data = await request<{ jobs: TrackAnalysisJob[] }>(
    apiRoutes.trackAnalysisJobs({ unread: true }),
  );
  return data.jobs;
}
