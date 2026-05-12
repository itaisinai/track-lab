import type { useRemixSearchMutation } from "../../../api/mutations/useRemixSearchMutation";
import type { SavedTrackResult } from "../../../types";

type UseSavedResultRemixSearchOptions = {
  closeDrawer: () => void;
  setResultsError: (error: string) => void;
  remixSearchMutation: ReturnType<typeof useRemixSearchMutation>;
  navigateToRemixJob: (jobId: number) => void;
};

export function useSavedResultRemixSearch({
  closeDrawer,
  navigateToRemixJob,
  remixSearchMutation,
  setResultsError,
}: UseSavedResultRemixSearchOptions) {
  async function searchRemixes(result: SavedTrackResult) {
    setResultsError("");

    try {
      const data = await remixSearchMutation.mutateAsync({
        title: result.title,
        artists: result.artists,
        spotifyUrl: getSpotifyUrl(result),
        genre: result.genre ?? null,
      });

      closeDrawer();
      navigateToRemixJob(data.job.id);
    } catch (error) {
      setResultsError(
        error instanceof Error ? error.message : "Could not search remixes",
      );
    }
  }

  return {
    isSearchingRemixes: remixSearchMutation.isPending,
    searchRemixes,
  };
}

function getSpotifyUrl(result: SavedTrackResult) {
  return result.toolsUsed.find((provider) => provider.name === "Spotify")?.url ?? null;
}
