import { useMutation } from "@tanstack/react-query";
import type {
  EnqueueRemixSearchResponse,
  RemixSearchRequest,
} from "@track-lab/api-types";
import { request } from "../request";
import { apiRoutes } from "../routes";

export function useRemixSearchMutation() {
  return useMutation({ mutationFn: searchRemixes });
}

async function searchRemixes(requestBody: RemixSearchRequest) {
  return request<EnqueueRemixSearchResponse>(apiRoutes.remixSearch, {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}
