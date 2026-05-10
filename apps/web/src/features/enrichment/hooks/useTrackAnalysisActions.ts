import { useState, type FormEvent } from "react";
import type { useReenrichSavedResultMutation } from "../../../api/mutations/useReenrichSavedResultMutation";
import type { useEnqueueTrackAnalysisMutation } from "../../../api/mutations/useEnqueueTrackAnalysisMutation";
import type { useSaveEnrichmentResponseMutation } from "../../../api/mutations/useSaveEnrichmentResponseMutation";
import type { SavedTrackResult, TrackAnalysisJob } from "../../../types";
import { getErrorMessage } from "../../../lib/errors/app-errors";

type AnalysisDraftState = {
  artists: string;
  lastEnrichmentResponse: unknown;
  title: string;
  trackDetails: {
    album?: string | null;
    bpm?: string | null;
    genre?: string | null;
    subGenre?: string | null;
    key?: string | null;
    spotifyUrl?: string | null;
  } | null;
  clearCurrentReviewState: () => void;
  setCurrentReviewJobId: (jobId: number | null) => void;
  setError: (error: string) => void;
  setLastEnrichmentResponse: (response: unknown) => void;
  setResponse: (response: string) => void;
  setSaveMessage: (message: string) => void;
  setShowSearchForm: (showSearchForm: boolean) => void;
};

type UseTrackAnalysisActionsOptions = {
  closeDrawer: () => void;
  draft: AnalysisDraftState;
  findCurrentReviewJob: () => TrackAnalysisJob | null;
  loadSavedResults: () => Promise<void>;
  reenrichResultMutation: ReturnType<typeof useReenrichSavedResultMutation>;
  refreshJobs: () => Promise<unknown>;
  resolveJob: (job: TrackAnalysisJob) => Promise<void>;
  enqueueTrackAnalysisMutation: ReturnType<typeof useEnqueueTrackAnalysisMutation>;
  saveEnrichmentResponseMutation: ReturnType<typeof useSaveEnrichmentResponseMutation>;
  navigateToView: (view: "enrich" | "results" | "review" | "datastore") => void;
  setResultsError: (error: string) => void;
};

export function useTrackAnalysisActions({
  closeDrawer,
  draft,
  findCurrentReviewJob,
  loadSavedResults,
  navigateToView,
  reenrichResultMutation,
  refreshJobs,
  resolveJob,
  enqueueTrackAnalysisMutation,
  saveEnrichmentResponseMutation,
  setResultsError,
}: UseTrackAnalysisActionsOptions) {
  const [reenrichingId, setReenrichingId] = useState<number | null>(null);
  const isLoading = enqueueTrackAnalysisMutation.isPending;
  const isSaving = saveEnrichmentResponseMutation.isPending;

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.title.trim() || !draft.artists.trim() || isLoading) {
      return;
    }

    await runTrackAnalysis("analyze");
  }

  async function runTrackAnalysis(operation: "analyze" | "enrich") {
    if (!draft.title.trim() || !draft.artists.trim() || isLoading) {
      return;
    }

    if (operation === "analyze") {
      draft.setShowSearchForm(true);
    }
    draft.setError("");
    draft.setResponse("");
    draft.setSaveMessage("");
    draft.setLastEnrichmentResponse(null);
    draft.setCurrentReviewJobId(null);

    try {
      const data = await enqueueTrackAnalysisMutation.mutateAsync({
        operation,
        track: {
          title: draft.title.trim(),
          artists: draft.artists.trim(),
        },
        source: "manual",
        knownMetadata:
          operation === "enrich" && draft.trackDetails
            ? {
                album: draft.trackDetails.album ?? null,
                bpm: draft.trackDetails.bpm
                  ? Number(draft.trackDetails.bpm)
                  : null,
                genre: draft.trackDetails.genre ?? null,
                subGenre: draft.trackDetails.subGenre ?? null,
                key: draft.trackDetails.key ?? null,
                spotifyUrl: draft.trackDetails.spotifyUrl ?? null,
              }
            : undefined,
      });
      draft.setResponse(`Queued ${operation} job #${data.job.id}.`);
      navigateToView("review");
      await refreshJobs();
    } catch (caughtError) {
      draft.setError(getErrorMessage(caughtError, "Something went wrong"));
    }
  }

  async function reenrichResult(result: SavedTrackResult) {
    setReenrichingId(result.id);
    draft.setError("");
    draft.setSaveMessage("");

    try {
      await reenrichResultMutation.mutateAsync(result.id);
      navigateToView("review");
      await refreshJobs();
      closeDrawer();
    } catch (caughtError) {
      setResultsError(getErrorMessage(caughtError, "Could not enrich result"));
    } finally {
      setReenrichingId(null);
    }
  }

  async function saveAndResolveCurrentJob() {
    const saved = await saveCurrentResponse();

    if (!saved) {
      return;
    }

    const currentJob = findCurrentReviewJob();

    if (currentJob) {
      await resolveJob(currentJob);
    }

    draft.clearCurrentReviewState();
    draft.setSaveMessage("Saved");
    navigateToView("review");
  }

  async function saveCurrentResponse() {
    if (!draft.lastEnrichmentResponse || isSaving) {
      return false;
    }

    draft.setSaveMessage("");
    draft.setError("");

    try {
      await saveEnrichmentResponseMutation.mutateAsync(draft.lastEnrichmentResponse);
      draft.setSaveMessage("Saved");
      await loadSavedResults();
      return true;
    } catch (caughtError) {
      draft.setError(getErrorMessage(caughtError, "Could not save result"));
      return false;
    }
  }

  return {
    isLoading,
    isSaving,
    reenrichingId,
    reenrichResult,
    runTrackAnalysis,
    saveAndResolveCurrentJob,
    submitPrompt,
  };
}
