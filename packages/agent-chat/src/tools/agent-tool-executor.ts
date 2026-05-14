import type {
  AgentTrackReference,
  AgentToolInput,
  AgentToolName,
  AnalyzeTrackToolInput,
  RemixSearchResponse,
  SearchRemixesToolInput,
} from "@track-lab/api-types";
import type { AgentSessionStore } from "@track-lab/datastore";
import type { RemixSearchOrchestrator } from "@track-lab/remix-search";
import type { TrackAnalysisOrchestrator } from "@track-lab/track-analysis";
import type { ToolExecution } from "../tool-execution.ts";
import { hasConcreteTrackReference } from "../planning/local-request-parser.ts";
import {
  createAnalyzeTrackTool,
  executeAnalyzeTrackTool,
} from "./analyze-track.tool.ts";
import {
  createSearchRemixesTool,
  executeSearchRemixesTool,
} from "./search-remixes.tool.ts";
import {
  logToolCallCompleted,
  logToolCallFailed,
  logToolCallStarted,
} from "./tool-logging.ts";

export class AgentToolExecutor {
  private readonly store: AgentSessionStore;
  private readonly remixSearch: RemixSearchOrchestrator;
  private readonly trackAnalysis: TrackAnalysisOrchestrator;

  constructor(
    store: AgentSessionStore,
    remixSearch: RemixSearchOrchestrator,
    trackAnalysis: TrackAnalysisOrchestrator,
  ) {
    this.store = store;
    this.remixSearch = remixSearch;
    this.trackAnalysis = trackAnalysis;
  }

  createTools(input: {
    sessionId: number;
    requestMessageId: number;
    executions: ToolExecution[];
  }) {
    return [
      createAnalyzeTrackTool(async (toolInput) => {
        const execution = await this.executeTool({
          ...input,
          toolName: "analyze_track",
          arguments: toolInput,
        });
        input.executions.push(execution);
        return execution.result;
      }),
      createSearchRemixesTool(async (toolInput) => {
        const execution = await this.executeTool({
          ...input,
          toolName: "search_remixes",
          arguments: toolInput,
        });
        input.executions.push(execution);
        return execution.result;
      }),
    ];
  }

  async executeTool(input: {
    sessionId: number;
    requestMessageId: number;
    toolName: AgentToolName;
    arguments: AgentToolInput;
  }): Promise<ToolExecution> {
    logToolCallStarted(input);
    const resolvedArguments = this.resolveToolArguments(
      input.sessionId,
      input.toolName,
      input.arguments,
    );

    const call = this.store.startToolCall({
      sessionId: input.sessionId,
      requestMessageId: input.requestMessageId,
      toolName: input.toolName,
      arguments: resolvedArguments,
    });

    try {
      const result =
        input.toolName === "analyze_track"
          ? await executeAnalyzeTrackTool(
              resolvedArguments as AnalyzeTrackToolInput,
              this.trackAnalysis,
            )
          : await executeSearchRemixesTool(
              resolvedArguments as SearchRemixesToolInput,
              this.remixSearch,
            );
      const completed = this.store.completeToolCall(call.id, result) ?? call;
      this.updateSessionContext(input.sessionId, input.toolName, resolvedArguments, result);
      logToolCallCompleted({
        sessionId: input.sessionId,
        requestMessageId: input.requestMessageId,
        toolCallId: completed.id,
        toolName: input.toolName,
        status: completed.status,
      });
      return {
        call: completed,
        result,
      };
    } catch (error) {
      const failed =
        this.store.failToolCall(call.id, getErrorMessage(error)) ?? call;
      logToolCallFailed({
        sessionId: input.sessionId,
        requestMessageId: input.requestMessageId,
        toolCallId: failed.id,
        toolName: input.toolName,
        status: failed.status,
        error: failed.errorMessage,
      });
      return {
        call: failed,
        result: null,
      };
    }
  }

  private resolveToolArguments(
    sessionId: number,
    toolName: AgentToolName,
    input: AgentToolInput,
  ): AgentToolInput {
    if (toolName !== "search_remixes") {
      return input;
    }

    const searchInput = input as SearchRemixesToolInput;
    if (
      searchInput.spotifyUrl ||
      (hasConcreteTrackReference(searchInput.title) &&
        hasConcreteTrackReference(searchInput.artists))
    ) {
      return searchInput;
    }

    const focusTrack = this.store.getSession(sessionId)?.metadata.currentFocusTrack;
    if (!focusTrack) {
      return searchInput;
    }

    return {
      ...searchInput,
      title: hasConcreteTrackReference(searchInput.title)
        ? searchInput.title
        : focusTrack.title,
      artists: hasConcreteTrackReference(searchInput.artists)
        ? searchInput.artists
        : focusTrack.artists,
      spotifyUrl: searchInput.spotifyUrl ?? focusTrack.spotifyUrl ?? null,
      genre: searchInput.genre ?? focusTrack.genre ?? null,
    };
  }

  private updateSessionContext(
    sessionId: number,
    toolName: AgentToolName,
    input: AgentToolInput,
    result: unknown,
  ) {
    if (toolName === "analyze_track") {
      const analysisInput = input as AnalyzeTrackToolInput;
      const track: AgentTrackReference = {
        title: analysisInput.title,
        artists: analysisInput.artists,
        spotifyUrl: analysisInput.knownMetadata?.spotifyUrl ?? null,
        genre: analysisInput.knownMetadata?.genre ?? null,
      };

      this.store.updateSessionMetadata(sessionId, (current) => ({
        ...current,
        currentFocusTrack: track,
        latestAnalyzedTrack: track,
        latestAnalysisResult: result,
      }));
      return;
    }

    const searchInput = input as SearchRemixesToolInput;
    const remixResult = result as RemixSearchResponse | null;
    const track: AgentTrackReference = remixResult?.originalTrack
      ? {
          title: remixResult.originalTrack.title,
          artists: remixResult.originalTrack.artists,
          spotifyUrl: remixResult.originalTrack.spotifyUrl ?? null,
          genre: searchInput.genre ?? remixResult.requestedGenre ?? null,
        }
      : {
          title: searchInput.title ?? "",
          artists: searchInput.artists ?? "",
          spotifyUrl: searchInput.spotifyUrl ?? null,
          genre: searchInput.genre ?? null,
        };

    if (!track.title || !track.artists) {
      return;
    }

    this.store.updateSessionMetadata(sessionId, (current) => ({
      ...current,
      currentFocusTrack: track,
      latestRemixSearchContext: {
        track,
        requestedGenre: remixResult?.requestedGenre ?? searchInput.genre ?? null,
        resultCount: remixResult?.candidates.length,
      },
    }));
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown agent runtime error.";
}
