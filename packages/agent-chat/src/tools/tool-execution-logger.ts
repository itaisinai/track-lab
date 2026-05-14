import type {
  AgentToolInput,
  AgentToolName,
  AnalyzeTrackToolInput,
  SearchRemixesToolInput,
} from "@track-lab/api-types";
import { createScopedLogger } from "@track-lab/logger";

const logAgentTool = createScopedLogger("agent-tool");

export function logToolCallStarted(input: {
  sessionId: number;
  requestMessageId: number;
  toolName: AgentToolName;
  arguments: AgentToolInput;
}) {
  logAgentTool("tool call started", {
    sessionId: input.sessionId,
    requestMessageId: input.requestMessageId,
    toolName: input.toolName,
    input: getToolLogInput(input.toolName, input.arguments),
  });
}

export function logToolCallCompleted(input: {
  sessionId: number;
  requestMessageId: number;
  toolCallId: number;
  toolName: AgentToolName;
  status: string;
}) {
  logAgentTool("tool call completed", input);
}

export function logToolCallFailed(input: {
  sessionId: number;
  requestMessageId: number;
  toolCallId: number;
  toolName: AgentToolName;
  status: string;
  error: string | null;
}) {
  logAgentTool("tool call failed", input);
}

function getToolLogInput(toolName: AgentToolName, input: AgentToolInput) {
  if (toolName === "search_remixes") {
    const remixInput = input as SearchRemixesToolInput;
    return {
      title: remixInput.title ?? null,
      artists: remixInput.artists ?? null,
      hasSpotifyUrl: Boolean(remixInput.spotifyUrl),
      genre: remixInput.genre ?? null,
    };
  }

  const analysisInput = input as AnalyzeTrackToolInput;
  return {
    title: analysisInput.title,
    artists: analysisInput.artists,
    operation: analysisInput.operation ?? "analyze",
    hasKnownMetadata: Boolean(analysisInput.knownMetadata),
  };
}
