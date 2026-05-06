import { useQuery } from "@tanstack/react-query";
import type { ListSavedRemixCandidatesResponse } from "@track-lab/api-types";
import { request } from "../request";
import { apiRoutes } from "../routes";
import { queryKeys } from "./queryKeys";

export function useSavedRemixesQuery() {
  return useQuery({
    queryKey: queryKeys.savedRemixes,
    queryFn: listSavedRemixes,
  });
}

async function listSavedRemixes() {
  const data = await request<ListSavedRemixCandidatesResponse>(
    apiRoutes.savedRemixes,
  );
  return data.remixes;
}
