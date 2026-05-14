import { useMutation } from "@tanstack/react-query";
import type { CreateAgentSessionResponse } from "@track-lab/api-types";
import { request } from "../request";
import { apiRoutes } from "../routes";

export function useCreateAgentSessionMutation() {
  return useMutation({ mutationFn: createAgentSession });
}

async function createAgentSession() {
  return request<CreateAgentSessionResponse>(apiRoutes.agentSessions, {
    method: "POST",
  });
}
