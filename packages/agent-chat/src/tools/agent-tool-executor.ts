import type {
  AgentTrackReference,
  AgentToolInput,
  AgentToolName,
  AnalyzeTrackToolInput,
  SearchRemixesToolInput,
} from "@track-lab/api-types";
import type { AgentSessionStore } from "@track-lab/datastore";
import type { TrackAnalysisOrchestrator } from "@track-lab/track-analysis";
import type { ToolExecution } from "../tool-execution.ts";
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

export type AgentToolRequestContext = {
  requestedTrack?: AgentTrackReference | null;
  requestedGenre?: string | null;
  usesCurrentFocus?: boolean;
  tool?: AgentToolName | "none";
};

export class AgentToolExecutor {
  private readonly store: AgentSessionStore;
  private readonly trackAnalysis: TrackAnalysisOrchestrator;

  constructor(
    store: AgentSessionStore,
    trackAnalysis: TrackAnalysisOrchestrator,
  ) {
    this.store = store;
    this.trackAnalysis = trackAnalysis;
  }

  createTools(input: {
    sessionId: number;
    requestMessageId: number;
    executions: ToolExecution[];
    requestContext?: AgentToolRequestContext;
  }) {
    return [
      createAnalyzeTrackTool(async (toolInput) => {
        const execution = await this.executeTool({
          ...input,
          toolName: "analyze_track",
          arguments: toolInput,
          requestContext: input.requestContext,
        });
        input.executions.push(execution);
        return execution.result;
      }),
      createSearchRemixesTool(async (toolInput) => {
        const execution = await this.executeTool({
          ...input,
          toolName: "search_remixes",
          arguments: toolInput,
          requestContext: input.requestContext,
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
    requestContext?: AgentToolRequestContext;
  }): Promise<ToolExecution> {
    const resolvedArguments = this.resolveToolArguments(
      input.sessionId,
      input.toolName,
      input.arguments,
      input.requestContext,
    );
    logToolCallStarted({
      ...input,
      arguments: resolvedArguments,
    });

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
              this.trackAnalysis,
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
    requestContext?: AgentToolRequestContext,
  ): AgentToolInput {
    if (toolName !== "search_remixes") {
      return input;
    }

    const searchInput = input as SearchRemixesToolInput;
    if (
      searchInput.spotifyUrl ||
      (hasValue(searchInput.title) && hasValue(searchInput.artists))
    ) {
      return {
        ...searchInput,
        genre:
          searchInput.genre ??
          requestContext?.requestedGenre ??
          requestContext?.requestedTrack?.genre ??
          null,
      };
    }

    const focusTrack = this.store.getSession(sessionId)?.metadata.currentFocusTrack;
    if (!focusTrack) {
      return searchInput;
    }

    return {
      ...searchInput,
      title: hasValue(searchInput.title)
        ? searchInput.title
        : requestContext?.requestedTrack?.title ?? focusTrack.title,
      artists: hasValue(searchInput.artists)
        ? searchInput.artists
        : requestContext?.requestedTrack?.artists ?? focusTrack.artists,
      spotifyUrl:
        searchInput.spotifyUrl ??
        requestContext?.requestedTrack?.spotifyUrl ??
        focusTrack.spotifyUrl ??
        null,
      genre:
        searchInput.genre ??
        requestContext?.requestedGenre ??
        requestContext?.requestedTrack?.genre ??
        focusTrack.genre ??
        null,
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
      this.updateDefaultSessionTitle(sessionId, track);
      return;
    }

    const searchInput = input as SearchRemixesToolInput;
    const track: AgentTrackReference = {
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
        requestedGenre: searchInput.genre ?? null,
        jobId: getQueuedJobId(result) ?? undefined,
      },
    }));
  }

  private updateDefaultSessionTitle(sessionId: number, track: AgentTrackReference) {
    const session = this.store.getSession(sessionId);
    if (!session || session.title !== "New chat") {
      return;
    }

    this.store.updateSessionTitle(sessionId, `${track.title} by ${track.artists}`);
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown agent runtime error.";
}

function getQueuedJobId(result: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return null;
  }

  const job = (result as { job?: unknown }).job;
  if (!job || typeof job !== "object" || Array.isArray(job)) {
    return null;
  }

  const id = (job as { id?: unknown }).id;
  return typeof id === "number" ? id : null;
}

function hasValue(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}
