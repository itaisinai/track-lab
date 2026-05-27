import { useQuery } from "@tanstack/react-query";
import { request } from "../request";
import { apiRoutes } from "../routes";
import type { TrackAnalysisJob } from "../../types";
import { queryKeys } from "./queryKeys";

export function useActiveJobsQuery() {
  return useQuery({
    queryKey: queryKeys.activeJobs,
    queryFn: listActiveJobs,
    refetchInterval: (query) =>
      (query.state.data as TrackAnalysisJob[] | undefined)?.length ? 1000 : 2000,
  });
}

async function listActiveJobs() {
  const data = await request<{ jobs: TrackAnalysisJob[] }>(
    apiRoutes.trackAnalysisJobs({ statuses: ["queued", "analyzing", "processing"] }),
  );
  return data.jobs;
}
