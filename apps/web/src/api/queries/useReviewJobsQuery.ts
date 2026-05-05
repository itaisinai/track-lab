import { useQuery } from "@tanstack/react-query";
import { request } from "../request";
import { apiRoutes } from "../routes";
import type { TrackAnalysisJob } from "../../types";
import { queryKeys } from "./queryKeys";

export function useReviewJobsQuery() {
  return useQuery({
    queryKey: queryKeys.reviewJobs,
    queryFn: listReviewJobs,
  });
}

async function listReviewJobs() {
  const data = await request<{ jobs: TrackAnalysisJob[] }>(
    apiRoutes.trackAnalysisJobs({ unresolved: true }),
  );
  return data.jobs;
}
