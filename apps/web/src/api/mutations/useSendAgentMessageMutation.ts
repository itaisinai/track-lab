import { useMutation } from "@tanstack/react-query";
import type {
  SendAgentMessageRequest,
  SendAgentMessageResponse,
} from "@track-lab/api-types";
import { request } from "../request";
import { apiRoutes } from "../routes";

export function useSendAgentMessageMutation() {
  return useMutation({ mutationFn: sendAgentMessage });
}

async function sendAgentMessage(input: {
  sessionId: number;
  request: SendAgentMessageRequest;
}) {
  return request<SendAgentMessageResponse>(apiRoutes.agentMessages(input.sessionId), {
    method: "POST",
    body: JSON.stringify(input.request),
  });
}
