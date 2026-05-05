import { useState } from "react";
import type { TrackLabQueries } from "../../../api/queries/useTrackLabQueries";
import { getErrorMessage } from "../../../lib/errors/app-errors";
import type { SavedTrackResult } from "../../../types";

type UseSavedResultsDataOptions = {
  closeDrawer: () => void;
  mutations: TrackLabQueries["mutations"];
  queries: TrackLabQueries["queries"];
  selectedResult: SavedTrackResult | null;
};

export function useSavedResultsData({
  closeDrawer,
  mutations,
  queries,
  selectedResult,
}: UseSavedResultsDataOptions) {
  const [resultsError, setResultsError] = useState("");

  async function loadSavedResults() {
    setResultsError("");

    try {
      await queries.results.refetch();
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
      await mutations.deleteResult.mutateAsync(result.id);
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
