import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { useMarkTrackAnalysisNotificationReadMutation } from "../../../api/mutations/useMarkTrackAnalysisNotificationReadMutation";
import type { useResolveTrackAnalysisJobMutation } from "../../../api/mutations/useResolveTrackAnalysisJobMutation";
import type { useRetryTrackAnalysisJobMutation } from "../../../api/mutations/useRetryTrackAnalysisJobMutation";
import { queryKeys } from "../../../api/queries/queryKeys";
import type { useActiveJobsQuery } from "../../../api/queries/useActiveJobsQuery";
import type { useAllJobsQuery } from "../../../api/queries/useAllJobsQuery";
import type { useNotificationJobsQuery } from "../../../api/queries/useNotificationJobsQuery";
import type { useReviewJobsQuery } from "../../../api/queries/useReviewJobsQuery";
import { request } from "../../../api/request";
import { apiRoutes } from "../../../api/routes";
import {
  getErrorMessage,
  getFirstErrorMessage,
} from "../../../lib/errors/app-errors";
import type { TrackAnalysisJob, View } from "../../../types";

type JobDraftActions = {
  clearCurrentReviewState: () => void;
  currentReviewJobId: number | null;
  loadJobIntoReview: (job: TrackAnalysisJob) => void;
  setSaveMessage: (message: string) => void;
};

type JobRoutingActions = {
  navigateToJob: (jobId: number) => void;
  navigateToRemixJob: (jobId: number) => void;
  navigateToView: (view: View) => void;
  setView: (view: View) => void;
};

type UseTrackAnalysisJobActionsOptions = {
  draft: JobDraftActions;
  activeJobsQuery: ReturnType<typeof useActiveJobsQuery>;
  allJobsQuery: ReturnType<typeof useAllJobsQuery>;
  markNotificationReadMutation: ReturnType<
    typeof useMarkTrackAnalysisNotificationReadMutation
  >;
  notificationJobsQuery: ReturnType<typeof useNotificationJobsQuery>;
  refreshJobs: () => Promise<unknown>;
  resolveJobMutation: ReturnType<typeof useResolveTrackAnalysisJobMutation>;
  retryJobMutation: ReturnType<typeof useRetryTrackAnalysisJobMutation>;
  reviewJobsQuery: ReturnType<typeof useReviewJobsQuery>;
  routing: JobRoutingActions;
};

export function useTrackAnalysisJobActions({
  activeJobsQuery,
  allJobsQuery,
  draft,
  markNotificationReadMutation,
  notificationJobsQuery,
  refreshJobs,
  resolveJobMutation,
  retryJobMutation,
  reviewJobsQuery,
  routing,
}: UseTrackAnalysisJobActionsOptions) {
  const queryClient = useQueryClient();
  const [jobsError, setJobsError] = useState("");
  const activeJobs = activeJobsQuery.data ?? [];
  const notificationJobs = notificationJobsQuery.data ?? [];
  const reviewJobs = reviewJobsQuery.data ?? [];
  const allJobs = allJobsQuery.data ?? [];
  const jobsErrorMessage =
    jobsError ||
    getFirstErrorMessage(
      [
        activeJobsQuery.error,
        notificationJobsQuery.error,
        reviewJobsQuery.error,
        allJobsQuery.error,
      ],
      "Could not load jobs",
    );

  async function refreshReviewJobs() {
    try {
      await reviewJobsQuery.refetch();
      setJobsError("");
    } catch (caughtError) {
      setJobsError(getErrorMessage(caughtError, "Could not load review queue"));
    }
  }

  async function refreshAllJobs() {
    try {
      await allJobsQuery.refetch();
      setJobsError("");
    } catch (caughtError) {
      setJobsError(getErrorMessage(caughtError, "Could not load datastore"));
    }
  }

  async function openJob(job: TrackAnalysisJob) {
    if (!job.notificationReadAt) {
      await markJobNotificationRead(job);
    }

    if (job.operation === "remix_search") {
      routing.navigateToRemixJob(job.id);
      await refreshJobs();
      return;
    }

    draft.loadJobIntoReview(job);
    routing.setView("enrich");
    routing.navigateToJob(job.id);
    await refreshJobs();
  }

  async function openJobFromRoute(jobId: number) {
    try {
      const job = await getTrackAnalysisJob(jobId);

      if (!job.notificationReadAt) {
        await markJobNotificationRead(job);
      }

      if (job.operation === "remix_search") {
        routing.setView("remix-search");
        await refreshJobs();
        return;
      }

      draft.loadJobIntoReview(job);
      routing.setView("enrich");
      await refreshJobs();
    } catch (caughtError) {
      setJobsError(getErrorMessage(caughtError, "Could not open review job"));
      routing.navigateToView("review");
    }
  }

  async function retryJob(job: TrackAnalysisJob) {
    try {
      await retryJobMutation.mutateAsync(job.id);
      await refreshJobs();
    } catch (caughtError) {
      setJobsError(getErrorMessage(caughtError, "Could not retry job"));
    }
  }

  async function resolveJob(job: TrackAnalysisJob) {
    try {
      await resolveJobMutation.mutateAsync(job.id);
      await refreshJobs();
    } catch (caughtError) {
      setJobsError(getErrorMessage(caughtError, "Could not resolve job"));
    }
  }

  async function dismissCurrentJob() {
    const currentJob = findCurrentReviewJob();

    if (!currentJob) {
      return;
    }

    await resolveJob(currentJob);
    draft.clearCurrentReviewState();
    draft.setSaveMessage("Dismissed");
    routing.navigateToView("review");
  }

  function findCurrentReviewJob() {
    if (!draft.currentReviewJobId) {
      return null;
    }

    return (
      reviewJobs.find((job) => job.id === draft.currentReviewJobId) ??
      allJobs.find((job) => job.id === draft.currentReviewJobId) ??
      null
    );
  }

  async function markJobNotificationRead(job: TrackAnalysisJob) {
    queryClient.setQueryData<TrackAnalysisJob[]>(
      queryKeys.notificationJobs,
      (currentJobs = []) =>
        currentJobs.filter((currentJob) => currentJob.id !== job.id),
    );
    await markNotificationReadMutation.mutateAsync(job.id);
  }

  return {
    activeJobs,
    allJobs,
    jobsError: jobsErrorMessage,
    notificationJobs,
    reviewJobs,
    dismissCurrentJob,
    findCurrentReviewJob,
    openJob,
    openJobFromRoute,
    refreshAllJobs,
    refreshReviewJobs,
    resolveJob,
    retryJob,
  };
}

async function getTrackAnalysisJob(id: number) {
  const data = await request<{ job: TrackAnalysisJob }>(
    apiRoutes.trackAnalysisJob(id),
  );
  return data.job;
}
