import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  SaveRemixCandidateRequest,
  SaveRemixCandidateResponse,
} from "@track-lab/api-types";
import { request } from "../request";
import { apiRoutes } from "../routes";
import { queryKeys } from "../queries/queryKeys";

export function useSaveRemixMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveRemix,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.savedRemixes });
    },
  });
}

async function saveRemix(requestBody: SaveRemixCandidateRequest) {
  const data = await request<SaveRemixCandidateResponse>(
    apiRoutes.savedRemixes,
    {
      method: "POST",
      body: JSON.stringify(requestBody),
    },
  );
  return data.remix;
}
