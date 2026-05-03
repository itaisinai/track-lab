import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { agent } from "./track-metadata-agent.ts";
import { agentTrackResultStore } from "./datastore/agent-track-result-store.ts";
import { parseTrackRequest } from "./input/track-request.ts";

export type TrackMetadataAgentOptions = {
  preferDatastore?: boolean;
};

export async function invokeTrackMetadataAgent(
  message: string,
  options: TrackMetadataAgentOptions = {},
) {
  const preferDatastore = options.preferDatastore ?? true;
  const request = parseTrackRequest(message);

  if (preferDatastore && request) {
    const savedResult = agentTrackResultStore.findByTrack(
      request.title,
      request.artists,
    );

    if (savedResult) {
      return new AIMessage(savedResult.rawResponse);
    }
  }

  const result = await agent.invoke({
    messages: [new HumanMessage(message)],
  });

  return result.messages[result.messages.length - 1];
}
