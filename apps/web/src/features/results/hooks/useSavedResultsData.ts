import { useState } from "react";
import type { useDeleteSavedResultMutation } from "../../../api/mutations/useDeleteSavedResultMutation";
import type { useSavedResultsQuery } from "../../../api/queries/useSavedResultsQuery";
import { getErrorMessage } from "../../../lib/errors/app-errors";
import type { SavedTrackResult } from "../../../types";

type UseSavedResultsDataOptions = {
  closeDrawer: () => void;
  deleteResultMutation: ReturnType<typeof useDeleteSavedResultMutation>;
  resultsQuery: ReturnType<typeof useSavedResultsQuery>;
  selectedResult: SavedTrackResult | null;
};

export function useSavedResultsData({
  closeDrawer,
  deleteResultMutation,
  resultsQuery,
  selectedResult,
}: UseSavedResultsDataOptions) {
  const [resultsError, setResultsError] = useState("");

  async function loadSavedResults() {
    setResultsError("");

    try {
      await resultsQuery.refetch();
    } catch (caughtError) {
      setResultsError(getErrorMessage(caughtError, "Could not load results"));
    }
  }

  async function deleteResult(result: SavedTrackResult) {
    const shouldDelete = window.confirm(
      `Remove "${result.title}" by ${result.artists}?`,
    );

    if (!shouldDelete) {
      return;
    }

    setResultsError("");

    try {
      await deleteResultMutation.mutateAsync(result.id);
      await loadSavedResults();

      if (selectedResult?.id === result.id) {
        closeDrawer();
      }
    } catch (caughtError) {
      setResultsError(getErrorMessage(caughtError, "Could not remove result"));
    }
  }

  return {
    deleteResult,
    loadSavedResults,
    resultsError,
    setResultsError,
  };
}
