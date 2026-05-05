import { useMutation } from "@tanstack/react-query";
import { request } from "../request";
import { apiRoutes } from "../routes";
import type { TrackAnalysisJob } from "../../types";

export type RunAgentOptions = {
  operation?: "analyze" | "enrich";
  skipPersistedResults?: boolean;
  knownMetadata?: unknown;
  track?: {
    title: string;
    artists: string;
  };
};

export function useRunAgentMutation() {
  return useMutation({ mutationFn: runAgentWithOptions });
}

function runAgentWithOptions({
  message,
  options,
}: {
  message: string;
  options: RunAgentOptions;
}) {
  return runAgent(message, options);
}

async function runAgent(message: string, options: RunAgentOptions = {}) {
  return request<{ job: Pick<TrackAnalysisJob, "id" | "status"> }>(
    apiRoutes.agent,
    {
      method: "POST",
      body: JSON.stringify({
        message,
        track: options.track,
        operation: options.operation ?? "analyze",
        skipPersistedResults: options.skipPersistedResults ?? false,
        knownMetadata: options.knownMetadata,
      }),
    },
  );
}
