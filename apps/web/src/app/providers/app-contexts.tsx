import { createContext, useContext } from "react";
import type { FormEvent } from "react";
import type {
  SavedTrackResult,
  TrackAnalysisJob,
  TrackDetails,
  View,
} from "../../types";
import type { DrawerState } from "../../shared/hooks/useResultDrawer";

export type AppShellContextValue = {
  activeJobs: TrackAnalysisJob[];
  currentReviewJobId: number | null;
  jobsError: string;
  notificationJobs: TrackAnalysisJob[];
  remixJobId: number | null;
  view: View;
  onAnalyzeClick: () => void;
  onDataStoreClick: () => void;
  onNotificationsClick: () => void;
  onRemixSearchClick: () => void;
  onSavedRemixesClick: () => void;
  onReviewClick: () => void;
  onSavedResultsClick: () => void;
};

export type EnrichmentContextValue = {
  artists: string;
  canSave: boolean;
  currentReviewJobId: number | null;
  error: string;
  isLoading: boolean;
  isSaving: boolean;
  response: string;
  saveMessage: string;
  showSearchForm: boolean;
  title: string;
  trackDetails: TrackDetails | null;
  onArtistsChange: (artists: string) => void;
  onDismissCurrentJob: () => void;
  onEnrich: () => void;
  onSaveCurrentJob: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTitleChange: (title: string) => void;
};

export type ResultsContextValue = {
  activeJobs: TrackAnalysisJob[];
  drawerState: DrawerState;
  isResultsLoading: boolean;
  isSearchingRemixes: boolean;
  reenrichingId: number | null;
  results: SavedTrackResult[];
  resultsError: string;
  selectedResult: SavedTrackResult | null;
  onCloseDrawer: () => void;
  onDeleteResult: (result: SavedTrackResult) => void;
  onMoreResult: (result: SavedTrackResult) => void;
  onRefreshResults: () => void;
  onReenrichResult: (result: SavedTrackResult) => void;
  onSearchRemixes: (result: SavedTrackResult) => void;
};

export type JobsContextValue = {
  allJobs: TrackAnalysisJob[];
  jobsError: string;
  notificationJobs: TrackAnalysisJob[];
  reviewJobs: TrackAnalysisJob[];
  results: SavedTrackResult[];
  onDismissJob: (job: TrackAnalysisJob) => void;
  onOpenJob: (job: TrackAnalysisJob) => void;
  onRefreshDataStore: () => void;
  onRefreshJobs: () => void;
  onRetryJob: (job: TrackAnalysisJob) => void;
};

export const AppShellContext = createContext<AppShellContextValue | null>(null);
export const EnrichmentContext =
  createContext<EnrichmentContextValue | null>(null);
export const ResultsContext = createContext<ResultsContextValue | null>(null);
export const JobsContext = createContext<JobsContextValue | null>(null);

export function useAppShell() {
  return useRequiredContext(AppShellContext, "useAppShell");
}

export function useEnrichmentContext() {
  return useRequiredContext(EnrichmentContext, "useEnrichmentContext");
}

export function useResultsContext() {
  return useRequiredContext(ResultsContext, "useResultsContext");
}

export function useJobsContext() {
  return useRequiredContext(JobsContext, "useJobsContext");
}

function useRequiredContext<T>(
  context: React.Context<T | null>,
  hookName: string,
) {
  const value = useContext(context);

  if (!value) {
    throw new Error(`${hookName} must be used inside AppProviders`);
  }

  return value;
}
