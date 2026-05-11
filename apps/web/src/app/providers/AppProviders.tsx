import type { ReactNode } from "react";
import { useDeleteSavedResultMutation } from "../../api/mutations/useDeleteSavedResultMutation";
import { useMarkTrackAnalysisNotificationReadMutation } from "../../api/mutations/useMarkTrackAnalysisNotificationReadMutation";
import { useReenrichSavedResultMutation } from "../../api/mutations/useReenrichSavedResultMutation";
import { useRemixSearchMutation } from "../../api/mutations/useRemixSearchMutation";
import { useResolveTrackAnalysisJobMutation } from "../../api/mutations/useResolveTrackAnalysisJobMutation";
import { useRetryTrackAnalysisJobMutation } from "../../api/mutations/useRetryTrackAnalysisJobMutation";
import { useEnqueueTrackAnalysisMutation } from "../../api/mutations/useEnqueueTrackAnalysisMutation";
import { useSaveEnrichmentResponseMutation } from "../../api/mutations/useSaveEnrichmentResponseMutation";
import { useActiveJobsQuery } from "../../api/queries/useActiveJobsQuery";
import { useAllJobsQuery } from "../../api/queries/useAllJobsQuery";
import { useNotificationJobsQuery } from "../../api/queries/useNotificationJobsQuery";
import { useReviewJobsQuery } from "../../api/queries/useReviewJobsQuery";
import { useSavedResultsQuery } from "../../api/queries/useSavedResultsQuery";
import { useTrackAnalysisActions } from "../../features/enrichment/hooks/useTrackAnalysisActions";
import { useReviewDraftState } from "../../features/enrichment/hooks/useReviewDraftState";
import { useSavedResultRemixSearch } from "../../features/results/hooks/useSavedResultRemixSearch";
import { useSavedResultsData } from "../../features/results/hooks/useSavedResultsData";
import { useTrackAnalysisJobActions } from "../../features/review-queue/hooks/useTrackAnalysisJobActions";
import { getErrorMessage } from "../../lib/errors/app-errors";
import { useResultDrawer } from "../../shared/hooks/useResultDrawer";
import { useAppRouting } from "../routing/useAppRouting";
import type { SavedTrackResult } from "../../types";
import {
  AppShellContext,
  EnrichmentContext,
  JobsContext,
  ResultsContext,
  type AppShellContextValue,
  type EnrichmentContextValue,
  type JobsContextValue,
  type ResultsContextValue,
} from "./app-contexts";

export function AppProviders({ children }: { children: ReactNode }) {
  const resultsQuery = useSavedResultsQuery();
  const activeJobsQuery = useActiveJobsQuery();
  const notificationJobsQuery = useNotificationJobsQuery();
  const reviewJobsQuery = useReviewJobsQuery();
  const allJobsQuery = useAllJobsQuery();
  const enqueueTrackAnalysisMutation = useEnqueueTrackAnalysisMutation();
  const remixSearchMutation = useRemixSearchMutation();
  const saveEnrichmentResponseMutation = useSaveEnrichmentResponseMutation();
  const reenrichResultMutation = useReenrichSavedResultMutation();
  const deleteResultMutation = useDeleteSavedResultMutation();
  const markNotificationReadMutation =
    useMarkTrackAnalysisNotificationReadMutation();
  const retryJobMutation = useRetryTrackAnalysisJobMutation();
  const resolveJobMutation = useResolveTrackAnalysisJobMutation();
  const draft = useReviewDraftState();
  const drawer = useResultDrawer<SavedTrackResult>();
  const savedResults = useSavedResultsData({
    closeDrawer: drawer.closeDrawer,
    deleteResultMutation,
    resultsQuery,
    selectedResult: drawer.selectedResult,
  });
  const routing = useAppRouting({
    setCurrentReviewJobId: draft.setCurrentReviewJobId,
    setShowSearchForm: draft.setShowSearchForm,
    loadSavedResults: savedResults.loadSavedResults,
    openJobFromRoute,
    openRemixJobFromRoute,
    refreshAllJobs,
    refreshReviewJobs,
  });
  const remixSearch = useSavedResultRemixSearch({
    closeDrawer: drawer.closeDrawer,
    navigateToRemixJob: routing.navigateToRemixJob,
    remixSearchMutation,
    setResultsError: savedResults.setResultsError,
  });
  const jobs = useTrackAnalysisJobActions({
    activeJobsQuery,
    allJobsQuery,
    draft: {
      clearCurrentReviewState: draft.clearCurrentReviewState,
      currentReviewJobId: draft.currentReviewJobId,
      loadJobIntoReview: draft.loadJobIntoReview,
      setSaveMessage: draft.setSaveMessage,
    },
    markNotificationReadMutation,
    notificationJobsQuery,
    refreshJobs,
    resolveJobMutation,
    retryJobMutation,
    reviewJobsQuery,
    routing,
  });
  const analysis = useTrackAnalysisActions({
    closeDrawer: drawer.closeDrawer,
    draft,
    findCurrentReviewJob: jobs.findCurrentReviewJob,
    loadSavedResults: savedResults.loadSavedResults,
    navigateToView: routing.navigateToView,
    reenrichResultMutation,
    refreshJobs,
    resolveJob: jobs.resolveJob,
    enqueueTrackAnalysisMutation,
    saveEnrichmentResponseMutation,
    setResultsError: savedResults.setResultsError,
  });
  const results = resultsQuery.data ?? [];
  const resultsError =
    savedResults.resultsError ||
    (resultsQuery.error
      ? getErrorMessage(resultsQuery.error, "Could not load results")
      : "");
  const appShellValue: AppShellContextValue = {
    activeJobs: jobs.activeJobs,
    currentReviewJobId: draft.currentReviewJobId,
    jobsError: jobs.jobsError,
    notificationJobs: jobs.notificationJobs,
    remixJobId: routing.remixJobId,
    view: routing.view,
    onAnalyzeClick: () => {
      draft.setShowSearchForm(true);
      routing.navigateToView("enrich");
    },
    onRemixSearchClick: () => {
      routing.navigateToView("remix-search");
    },
    onSavedRemixesClick: () => {
      routing.navigateToView("saved-remixes");
    },
    onDataStoreClick: () => {
      routing.navigateToView("datastore");
      void Promise.all([jobs.refreshAllJobs(), savedResults.loadSavedResults()]);
    },
    onNotificationsClick: () => {
      routing.navigateToView("review");
      void refreshJobs();
    },
    onReviewClick: () => {
      routing.navigateToView("review");
      void jobs.refreshReviewJobs();
    },
    onSavedResultsClick: () => {
      routing.navigateToView("results");
      void savedResults.loadSavedResults();
    },
  };
  const enrichmentValue: EnrichmentContextValue = {
    artists: draft.artists,
    canSave: Boolean(draft.lastEnrichmentResponse),
    currentReviewJobId: draft.currentReviewJobId,
    error: draft.error,
    isLoading: analysis.isLoading,
    isSaving: analysis.isSaving,
    response: draft.response,
    saveMessage: draft.saveMessage,
    showSearchForm: draft.showSearchForm,
    title: draft.title,
    trackDetails: draft.trackDetails,
    onArtistsChange: draft.setArtists,
    onDismissCurrentJob: () => void jobs.dismissCurrentJob(),
    onEnrich: () => void analysis.runTrackAnalysis("enrich"),
    onSaveCurrentJob: () => void analysis.saveAndResolveCurrentJob(),
    onSubmit: analysis.submitPrompt,
    onTitleChange: draft.setTitle,
  };
  const resultsValue: ResultsContextValue = {
    activeJobs: jobs.activeJobs,
    drawerState: drawer.drawerState,
    isResultsLoading: resultsQuery.isLoading,
    isSearchingRemixes: remixSearch.isSearchingRemixes,
    reenrichingId: analysis.reenrichingId,
    results,
    resultsError,
    selectedResult: drawer.selectedResult,
    onCloseDrawer: drawer.closeDrawer,
    onDeleteResult: (result) => void savedResults.deleteResult(result),
    onMoreResult: drawer.openDrawer,
    onRefreshResults: () => void savedResults.loadSavedResults(),
    onReenrichResult: (result) => void analysis.reenrichResult(result),
    onSearchRemixes: (result) => void remixSearch.searchRemixes(result),
  };
  const jobsValue: JobsContextValue = {
    allJobs: jobs.allJobs,
    jobsError: jobs.jobsError,
    notificationJobs: jobs.notificationJobs,
    reviewJobs: jobs.reviewJobs,
    results,
    onDismissJob: (job) => void jobs.resolveJob(job),
    onOpenJob: (job) => void jobs.openJob(job),
    onRefreshDataStore: () =>
      void Promise.all([jobs.refreshAllJobs(), savedResults.loadSavedResults()]),
    onRefreshJobs: () => void refreshJobs(),
    onRetryJob: (job) => void jobs.retryJob(job),
  };

  async function openJobFromRoute(jobId: number) {
    await jobs.openJobFromRoute(jobId);
  }

  function openRemixJobFromRoute(_jobId: number) {
    return;
  }

  async function refreshAllJobs() {
    await jobs.refreshAllJobs();
  }

  async function refreshReviewJobs() {
    await jobs.refreshReviewJobs();
  }

  function refreshJobs() {
    return Promise.all([
      activeJobsQuery.refetch(),
      notificationJobsQuery.refetch(),
      reviewJobsQuery.refetch(),
      allJobsQuery.refetch(),
    ]);
  }

  return (
    <AppShellContext.Provider value={appShellValue}>
      <EnrichmentContext.Provider value={enrichmentValue}>
        <ResultsContext.Provider value={resultsValue}>
          <JobsContext.Provider value={jobsValue}>
            {children}
          </JobsContext.Provider>
        </ResultsContext.Provider>
      </EnrichmentContext.Provider>
    </AppShellContext.Provider>
  );
}
