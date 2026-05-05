import { useQuery } from "@tanstack/react-query";
import { request } from "../request";
import { apiRoutes } from "../routes";
import type { SavedTrackResult } from "../../types";
import { queryKeys } from "./queryKeys";

export function useSavedResultsQuery() {
  return useQuery({
    queryKey: queryKeys.results,
    queryFn: listResults,
  });
}

async function listResults() {
  const data = await request<{ results: SavedTrackResult[] }>(
    apiRoutes.results,
  );
  return data.results;
}
