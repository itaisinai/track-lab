import { useState } from "react";
import { getTrackAnalysisJob } from "../../../api/track-lab-api";
import {
  queryKeys,
  type TrackLabQueries,
} from "../../../api/queries/useTrackLabQueries";
import {
  getErrorMessage,
  getFirstErrorMessage,
} from "../../../lib/errors/app-errors";
import type { TrackAnalysisJob } from "../../../types";

type JobDraftActions = {
  clearCurrentReviewState: () => void;
  currentReviewJobId: number | null;
  loadJobIntoReview: (job: TrackAnalysisJob) => void;
  setSaveMessage: (message: string) => void;
};

type JobRoutingActions = {
  navigateToJob: (jobId: number) => void;
  navigateToView: (view: "enrich" | "results" | "review" | "datastore") => void;
  setView: (view: "enrich" | "results" | "review" | "datastore") => void;
};

type UseTrackAnalysisJobActionsOptions = {
  draft: JobDraftActions;
  queries: TrackLabQueries["queries"];
  mutations: TrackLabQueries["mutations"];
  queryClient: TrackLabQueries["queryClient"];
  refreshJobs: TrackLabQueries["refreshJobs"];
  routing: JobRoutingActions;
};

export function useTrackAnalysisJobActions({
  draft,
  mutations,
  queries,
  queryClient,
  refreshJobs,
  routing,
}: UseTrackAnalysisJobActionsOptions) {
  const [jobsError, setJobsError] = useState("");
  const activeJobs = queries.activeJobs.data ?? [];
  const notificationJobs = queries.notificationJobs.data ?? [];
  const reviewJobs = queries.reviewJobs.data ?? [];
  const allJobs = queries.allJobs.data ?? [];
  const jobsErrorMessage =
    jobsError ||
    getFirstErrorMessage(
      [
        queries.activeJobs.error,
        queries.notificationJobs.error,
        queries.reviewJobs.error,
        queries.allJobs.error,
      ],
      "Could not load jobs",
    );

  async function refreshReviewJobs() {
    try {
      await queries.reviewJobs.refetch();
      setJobsError("");
    } catch (caughtError) {
      setJobsError(getErrorMessage(caughtError, "Could not load review queue"));
    }
  }

  async function refreshAllJobs() {
    try {
      await queries.allJobs.refetch();
      setJobsError("");
    } catch (caughtError) {
      setJobsError(getErrorMessage(caughtError, "Could not load datastore"));
    }
  }

  async function openJob(job: TrackAnalysisJob) {
    if (!job.notificationReadAt) {
      await markJobNotificationRead(job);
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
      await mutations.retryJob.mutateAsync(job.id);
      await refreshJobs();
    } catch (caughtError) {
      setJobsError(getErrorMessage(caughtError, "Could not retry job"));
    }
  }

  async function resolveJob(job: TrackAnalysisJob) {
    try {
      await mutations.resolveJob.mutateAsync(job.id);
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
    await mutations.markNotificationRead.mutateAsync(job.id);
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
