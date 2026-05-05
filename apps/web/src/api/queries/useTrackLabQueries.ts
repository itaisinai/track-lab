import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteSavedResult,
  listTrackAnalysisJobs,
  listResults,
  markTrackAnalysisNotificationRead,
  reenrichSavedResult,
  resolveTrackAnalysisJob,
  retryTrackAnalysisJob,
  runAgent,
  saveAgentResponse,
  type RunAgentOptions,
} from "../track-lab-api";
import type { TrackAnalysisJob } from "../../types";

export const queryKeys = {
  results: ["results"] as const,
  activeJobs: ["track-analysis-jobs", "active"] as const,
  notificationJobs: ["track-analysis-jobs", "notifications"] as const,
  reviewJobs: ["track-analysis-jobs", "review"] as const,
  allJobs: ["track-analysis-jobs", "all"] as const,
};

export type TrackLabQueries = ReturnType<typeof useTrackLabQueries>;

export function useTrackLabQueries() {
  const queryClient = useQueryClient();
  const resultsQuery = useQuery({
    queryKey: queryKeys.results,
    queryFn: listResults,
  });
  const activeJobsQuery = useQuery({
    queryKey: queryKeys.activeJobs,
    queryFn: () =>
      listTrackAnalysisJobs({ statuses: ["queued", "processing"] }),
    refetchInterval: (query) =>
      (query.state.data as TrackAnalysisJob[] | undefined)?.length ? 1000 : 2000,
  });
  const notificationJobsQuery = useQuery({
    queryKey: queryKeys.notificationJobs,
    queryFn: () => listTrackAnalysisJobs({ unread: true }),
    refetchInterval: 7000,
  });
  const reviewJobsQuery = useQuery({
    queryKey: queryKeys.reviewJobs,
    queryFn: () => listTrackAnalysisJobs({ unresolved: true }),
  });
  const allJobsQuery = useQuery({
    queryKey: queryKeys.allJobs,
    queryFn: () => listTrackAnalysisJobs(),
  });

  return {
    queryClient,
    queries: {
      results: resultsQuery,
      activeJobs: activeJobsQuery,
      notificationJobs: notificationJobsQuery,
      reviewJobs: reviewJobsQuery,
      allJobs: allJobsQuery,
    },
    mutations: {
      runAgent: useMutation({ mutationFn: runAgentWithOptions }),
      saveResult: useMutation({ mutationFn: saveAgentResponse }),
      reenrichResult: useMutation({ mutationFn: reenrichSavedResult }),
      deleteResult: useMutation({ mutationFn: deleteSavedResult }),
      markNotificationRead: useMutation({
        mutationFn: markTrackAnalysisNotificationRead,
      }),
      retryJob: useMutation({ mutationFn: retryTrackAnalysisJob }),
      resolveJob: useMutation({ mutationFn: resolveTrackAnalysisJob }),
    },
    refreshJobs: () =>
      Promise.all([
        activeJobsQuery.refetch(),
        notificationJobsQuery.refetch(),
        reviewJobsQuery.refetch(),
        allJobsQuery.refetch(),
      ]),
  };
}

function runAgentWithOptions({
  message,
  options,
}: {
  message: string;
  options: RunAgentOptions;
}) {
  return runAgent(message, options);
}
