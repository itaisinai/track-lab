import { HumanMessage } from "@langchain/core/messages";
import { metadataAgent } from "./metadata-agent.ts";
import { getEnrichmentTrackResultRepository } from "./datastore/enrichment-track-result-repository.ts";
import { createDatastoreEnrichmentStore } from "./enrichment/enrichment-result-store.ts";
import { enrichTrackMetadata } from "./enrichment/track-metadata-enrichment.ts";
import { parseTrackRequest } from "./input/track-request.ts";

export type MetadataEnrichmentOptions = {
  operation?: "analyze" | "enrich";
  preferDatastore?: boolean;
  knownMetadata?: Partial<{
    album: string | null;
    bpm: number | null;
    genre: string | null;
    subGenre: string | null;
    key: string | null;
    spotifyUrl: string | null;
  }>;
};

export async function invokeMetadataEnrichment(
  message: string,
  options: MetadataEnrichmentOptions = {},
) {
  const preferDatastore = options.preferDatastore ?? true;
  const request = parseTrackRequest(message);

  if (request) {
    const result = await enrichTrackMetadata(
      {
        operation: options.operation ?? "analyze",
        trackName: request.title,
        artist: request.artists,
        knownMetadata: options.knownMetadata,
      },
      {
        store: preferDatastore && options.operation !== "enrich"
          ? createDatastoreEnrichmentStore(getEnrichmentTrackResultRepository())
          : undefined,
      },
    );

    return result;
  }

  const result = await metadataAgent.invoke({
    messages: [new HumanMessage(message)],
  });

  return parseAgentMessage(result.messages[result.messages.length - 1]);
}

function parseAgentMessage(message: unknown) {
  const content = getMessageContent(message);

  if (typeof content !== "string") {
    return message;
  }

  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

function getMessageContent(message: unknown) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return null;
  }

  const content = (message as Record<string, unknown>).content;
  return typeof content === "string" ? content : null;
}
