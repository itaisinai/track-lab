import { useQuery } from "@tanstack/react-query";
import { request } from "../request";
import { apiRoutes } from "../routes";
import type { TrackAnalysisJob } from "../../types";
import { queryKeys } from "./queryKeys";

export function useAllJobsQuery() {
  return useQuery({
    queryKey: queryKeys.allJobs,
    queryFn: listAllJobs,
  });
}

async function listAllJobs() {
  const data = await request<{ jobs: TrackAnalysisJob[] }>(
    apiRoutes.trackAnalysisJobs(),
  );
  return data.jobs;
}
