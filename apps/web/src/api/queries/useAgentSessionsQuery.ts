import { useQuery } from "@tanstack/react-query";
import type { ListAgentSessionsResponse } from "@track-lab/api-types";
import { request } from "../request";
import { apiRoutes } from "../routes";
import { queryKeys } from "./queryKeys";

export function useAgentSessionsQuery() {
  return useQuery({
    queryKey: queryKeys.agentSessions,
    queryFn: listAgentSessions,
  });
}

async function listAgentSessions() {
  const data = await request<ListAgentSessionsResponse>(apiRoutes.agentSessions);
  return data.sessions;
}
