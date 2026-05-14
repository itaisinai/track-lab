import { useQuery } from "@tanstack/react-query";
import type { GetAgentSessionResponse } from "@track-lab/api-types";
import { request } from "../request";
import { apiRoutes } from "../routes";
import { queryKeys } from "./queryKeys";

export function useAgentSessionQuery(sessionId: number | null) {
  return useQuery({
    queryKey: sessionId
      ? queryKeys.agentSession(sessionId)
      : ["agent", "sessions", "none"],
    queryFn: () => getAgentSession(sessionId as number),
    enabled: Boolean(sessionId),
  });
}

async function getAgentSession(sessionId: number) {
  return request<GetAgentSessionResponse>(apiRoutes.agentSession(sessionId));
}
