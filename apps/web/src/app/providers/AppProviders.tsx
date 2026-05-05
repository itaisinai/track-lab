import type { ReactNode } from "react";
import { useTrackLabQueries } from "../../api/queries/useTrackLabQueries";
import { useTrackAnalysisActions } from "../../features/enrichment/hooks/useTrackAnalysisActions";
import { useReviewDraftState } from "../../features/enrichment/hooks/useReviewDraftState";
import { useSavedResultsData } from "../../features/results/hooks/useSavedResultsData";
import { useTrackAnalysisJobActions } from "../../features/review-queue/hooks/useTrackAnalysisJobActions";
import { getErrorMessage } from "../../lib/errors/app-errors";
import { useResultDrawer } from "../../shared/hooks/useResultDrawer";
import { useAppRouting } from "../routing/useAppRouting";
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
  const { queryClient, queries, mutations, refreshJobs } = useTrackLabQueries();
  const draft = useReviewDraftState();
  const drawer = useResultDrawer();
  const savedResults = useSavedResultsData({
    closeDrawer: drawer.closeDrawer,
    mutations,
    queries,
    selectedResult: drawer.selectedResult,
  });
  const routing = useAppRouting({
    setCurrentReviewJobId: draft.setCurrentReviewJobId,
    setShowSearchForm: draft.setShowSearchForm,
    loadSavedResults: savedResults.loadSavedResults,
    openJobFromRoute,
    refreshAllJobs,
    refreshReviewJobs,
  });
  const jobs = useTrackAnalysisJobActions({
    draft: {
      clearCurrentReviewState: draft.clearCurrentReviewState,
      currentReviewJobId: draft.currentReviewJobId,
      loadJobIntoReview: draft.loadJobIntoReview,
      setSaveMessage: draft.setSaveMessage,
    },
    mutations,
    queries,
    queryClient,
    refreshJobs,
    routing,
  });
  const analysis = useTrackAnalysisActions({
    closeDrawer: drawer.closeDrawer,
    draft,
    findCurrentReviewJob: jobs.findCurrentReviewJob,
    loadSavedResults: savedResults.loadSavedResults,
    mutations,
    navigateToView: routing.navigateToView,
    refreshJobs,
    resolveJob: jobs.resolveJob,
    setResultsError: savedResults.setResultsError,
  });
  const results = queries.results.data ?? [];
  const resultsError =
    savedResults.resultsError ||
    (queries.results.error
      ? getErrorMessage(queries.results.error, "Could not load results")
      : "");
  const appShellValue: AppShellContextValue = {
    activeJobs: jobs.activeJobs,
    currentReviewJobId: draft.currentReviewJobId,
    jobsError: jobs.jobsError,
    notificationJobs: jobs.notificationJobs,
    view: routing.view,
    onAnalyzeClick: () => {
      draft.setShowSearchForm(true);
      routing.navigateToView("enrich");
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
    canSave: Boolean(draft.lastAgentResponse),
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
    isResultsLoading: queries.results.isLoading,
    reenrichingId: analysis.reenrichingId,
    results,
    resultsError,
    selectedResult: drawer.selectedResult,
    onCloseDrawer: drawer.closeDrawer,
    onDeleteResult: (result) => void savedResults.deleteResult(result),
    onMoreResult: drawer.openDrawer,
    onRefreshResults: () => void savedResults.loadSavedResults(),
    onReenrichResult: (result) => void analysis.reenrichResult(result),
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

  async function refreshAllJobs() {
    await jobs.refreshAllJobs();
  }

  async function refreshReviewJobs() {
    await jobs.refreshReviewJobs();
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
