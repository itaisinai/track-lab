import type {
  AgentToolInput,
  AgentToolName,
  AnalyzeTrackToolInput,
  SearchRemixesToolInput,
} from "@track-lab/api-types";
import type { AgentSessionStore } from "@track-lab/datastore";
import type { RemixSearchOrchestrator } from "@track-lab/remix-search";
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

    const call = this.store.startToolCall({
      sessionId: input.sessionId,
      requestMessageId: input.requestMessageId,
      toolName: input.toolName,
      arguments: input.arguments,
    });

    try {
      const result =
        input.toolName === "analyze_track"
          ? await executeAnalyzeTrackTool(
              input.arguments as AnalyzeTrackToolInput,
              this.trackAnalysis,
            )
          : await executeSearchRemixesTool(
              input.arguments as SearchRemixesToolInput,
              this.remixSearch,
            );
      const completed = this.store.completeToolCall(call.id, result) ?? call;
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
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown agent runtime error.";
}
