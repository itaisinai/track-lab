import { useMutation } from "@tanstack/react-query";
import type { DeleteAgentSessionResponse } from "@track-lab/api-types";
import { request } from "../request";
import { apiRoutes } from "../routes";

export function useDeleteAgentSessionMutation() {
  return useMutation({ mutationFn: deleteAgentSession });
}

async function deleteAgentSession(sessionId: number) {
  return request<DeleteAgentSessionResponse>(apiRoutes.agentSession(sessionId), {
    method: "DELETE",
  });
}
