import type {
  AgentMessage,
  AgentSession,
  AgentToolCall,
  SearchRemixesToolInput,
} from "@track-lab/api-types";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { AgentSessionStore } from "@track-lab/datastore";
import { RemixSearchOrchestrator } from "@track-lab/remix-search";
import { TrackAnalysisOrchestrator } from "@track-lab/track-analysis";
import { createAgent } from "langchain";
import { AGENT_SYSTEM_PROMPT } from "./prompts/agent-system-prompt.ts";
import {
  hasConcreteTrackReference,
  isAnalyzeRequest,
  isRemixRequest,
  parseAnalyzeRequest,
  parseRemixRequest,
} from "./planning/local-request-parser.ts";
import {
  buildAssistantMetadata,
  getFinalMessageContent,
  summarizeToolCalls,
} from "./response/agent-response.ts";
import type { ToolExecution } from "./tool-execution.ts";
import { AgentToolExecutor } from "./tools/agent-tool-executor.ts";

export type AgentRuntimeOptions = {
  modelName?: string;
  useLlm?: boolean;
  store?: AgentSessionStore;
  remixSearch?: RemixSearchOrchestrator;
  trackAnalysis?: TrackAnalysisOrchestrator;
};

type AgentInvocation = {
  content: string;
  toolCalls: ToolExecution[];
};

const RECENT_MESSAGE_LIMIT = 8;
const RELEVANT_TOOL_RESULT_LIMIT = 4;

export class AgentRuntime {
  private readonly store: AgentSessionStore;
  private readonly remixSearch: RemixSearchOrchestrator;
  private readonly trackAnalysis: TrackAnalysisOrchestrator;
  private readonly toolExecutor: AgentToolExecutor;
  private readonly modelName: string;
  private readonly useLlm: boolean;

  constructor(options: AgentRuntimeOptions = {}) {
    this.store = options.store ?? new AgentSessionStore();
    this.remixSearch = options.remixSearch ?? new RemixSearchOrchestrator();
    this.trackAnalysis =
      options.trackAnalysis ?? new TrackAnalysisOrchestrator();
    this.toolExecutor = new AgentToolExecutor(
      this.store,
      this.remixSearch,
      this.trackAnalysis,
    );
    this.modelName = options.modelName ?? "gpt-5-nano";
    this.useLlm = options.useLlm ?? Boolean(process.env.OPENAI_API_KEY);
  }

  async sendMessage(sessionId: number, content: string) {
    const session = this.store.getSession(sessionId);

    if (!session) {
      throw new Error("Agent session was not found.");
    }

    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error("Message content is required.");
    }

    const targetSession = this.resolveSessionForMessage(session, trimmed);
    const targetSessionId = targetSession.id;
    const requestMessage = this.store.addMessage({
      sessionId: targetSessionId,
      role: "user",
      content: trimmed,
    });

    const invocation = this.useLlm
      ? await this.invokeLlmAgent(targetSessionId, requestMessage, trimmed)
      : await this.invokeLocalPlanner(targetSessionId, requestMessage, trimmed);

    const metadata = buildAssistantMetadata(invocation.toolCalls);
    const assistantMessage = this.store.addMessage({
      sessionId: targetSessionId,
      role: "assistant",
      content: invocation.content,
      metadata,
    });
    this.store.attachToolCallsToAssistantMessage(
      invocation.toolCalls.map(({ call }) => call.id),
      assistantMessage.id,
    );

    return {
      message: assistantMessage,
      session: this.store.getSession(targetSessionId),
      messages: this.store.listMessages(targetSessionId),
      toolCalls: this.store.listToolCalls(targetSessionId),
    };
  }

  private async invokeLlmAgent(
    sessionId: number,
    requestMessage: AgentMessage,
    content: string,
  ): Promise<AgentInvocation> {
    const toolCalls: ToolExecution[] = [];
    const tools = this.toolExecutor.createTools({
      sessionId,
      requestMessageId: requestMessage.id,
      executions: toolCalls,
    });
    const agent = createAgent({
      model: new ChatOpenAI({ model: this.modelName }),
      tools,
      systemPrompt: this.buildSystemPrompt(sessionId),
    });

    try {
      const result = await agent.invoke({
        messages: this.buildLlmMessages(sessionId),
      });
      return {
        content: getFinalMessageContent(result) ?? summarizeToolCalls(toolCalls),
        toolCalls,
      };
    } catch (error) {
      if (toolCalls.length) {
        return {
          content: summarizeToolCalls(toolCalls),
          toolCalls,
        };
      }

      return this.invokeLocalPlanner(sessionId, requestMessage, content);
    }
  }

  private async invokeLocalPlanner(
    sessionId: number,
    requestMessage: AgentMessage,
    content: string,
  ): Promise<AgentInvocation> {
    if (isRemixRequest(content)) {
      const input = this.resolveRemixInputFromSession(
        sessionId,
        parseRemixRequest(content),
      );

      if (!input.spotifyUrl && (!input.title || !input.artists)) {
        return {
          content: "Send a Spotify URL or include both the track title and artist.",
          toolCalls: [],
        };
      }

      const execution = await this.toolExecutor.executeTool({
        sessionId,
        requestMessageId: requestMessage.id,
        toolName: "search_remixes",
        arguments: input,
      });
      return {
        content: summarizeToolCalls([execution]),
        toolCalls: [execution],
      };
    }

    const input = parseAnalyzeRequest(content);

    if (!input.title || !input.artists) {
      return {
        content: "Send the track title and artist, for example: analyze Strobe by deadmau5.",
        toolCalls: [],
      };
    }

    const execution = await this.toolExecutor.executeTool({
      sessionId,
      requestMessageId: requestMessage.id,
      toolName: "analyze_track",
      arguments: input,
    });
    return {
      content: summarizeToolCalls([execution]),
      toolCalls: [execution],
    };
  }

  private resolveSessionForMessage(session: AgentSession, content: string) {
    if (!isAnalyzeRequest(content)) {
      return session;
    }

    const requestedTrack = parseAnalyzeRequest(content);
    if (!requestedTrack.title || !requestedTrack.artists) {
      return session;
    }

    const focusTrack = session.metadata.currentFocusTrack;
    if (!focusTrack || sameTrack(focusTrack, requestedTrack)) {
      return session;
    }

    return this.store.createSession(
      `${requestedTrack.title} by ${requestedTrack.artists}`,
    );
  }

  private resolveRemixInputFromSession(
    sessionId: number,
    input: SearchRemixesToolInput,
  ): SearchRemixesToolInput {
    if (
      input.spotifyUrl ||
      (hasConcreteTrackReference(input.title) &&
        hasConcreteTrackReference(input.artists))
    ) {
      return input;
    }

    const focusTrack = this.store.getSession(sessionId)?.metadata.currentFocusTrack;
    if (!focusTrack) {
      return input;
    }

    return {
      ...input,
      title: hasConcreteTrackReference(input.title) ? input.title : focusTrack.title,
      artists: hasConcreteTrackReference(input.artists)
        ? input.artists
        : focusTrack.artists,
      spotifyUrl: input.spotifyUrl ?? focusTrack.spotifyUrl ?? null,
      genre: input.genre ?? focusTrack.genre ?? null,
    };
  }

  private buildSystemPrompt(sessionId: number) {
    const session = this.store.getSession(sessionId);
    const relevantToolResults = this.store
      .listToolCalls(sessionId)
      .filter((call) => call.status === "completed")
      .slice(-RELEVANT_TOOL_RESULT_LIMIT)
      .map(summarizeToolCallForContext);

    return `${AGENT_SYSTEM_PROMPT}

Current session context:
${JSON.stringify(
  {
    metadata: session?.metadata ?? {},
    relevantToolResults,
  },
  null,
  2,
)}`;
  }

  private buildLlmMessages(sessionId: number) {
    return this.store
      .listMessages(sessionId)
      .slice(-RECENT_MESSAGE_LIMIT)
      .map((message) =>
        message.role === "assistant"
          ? new AIMessage(message.content)
          : new HumanMessage(message.content),
      );
  }

}

function sameTrack(
  left: { title: string; artists: string },
  right: { title: string; artists: string },
) {
  return normalizeTrackText(left.title) === normalizeTrackText(right.title) &&
    normalizeTrackText(left.artists) === normalizeTrackText(right.artists);
}

function normalizeTrackText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function summarizeToolCallForContext(call: AgentToolCall) {
  if (call.toolName === "analyze_track") {
    return {
      toolName: call.toolName,
      arguments: call.arguments,
      result: summarizeAnalysisResult(call.result),
    };
  }

  const result = call.result as
    | { candidates?: unknown[]; originalTrack?: unknown; requestedGenre?: unknown }
    | null;

  return {
    toolName: call.toolName,
    arguments: call.arguments,
    result: {
      originalTrack: result?.originalTrack,
      requestedGenre: result?.requestedGenre ?? null,
      candidateCount: result?.candidates?.length ?? 0,
    },
  };
}

function summarizeAnalysisResult(result: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return result;
  }

  const record = result as {
    job?: { id?: unknown; status?: unknown; operation?: unknown };
    summary?: unknown;
    status?: unknown;
  };

  if (record.job) {
    return { job: record.job };
  }

  return {
    status: record.status,
    summary: record.summary,
  };
}
