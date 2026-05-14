import type {
  AgentMessage,
  AgentSession,
  AgentToolCall,
  AgentTrackReference,
} from "@track-lab/api-types";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { AgentSessionStore } from "@track-lab/datastore";
import { createScopedLogger } from "@track-lab/logger";
import { TrackAnalysisOrchestrator } from "@track-lab/track-analysis";
import { createAgent } from "langchain";
import { AGENT_SYSTEM_PROMPT } from "./prompts/system-prompt.ts";
import {
  buildAssistantMetadata,
  getFinalMessageContent,
  summarizeToolCalls,
} from "./response/assistant-response-builder.ts";
import type { ToolExecution } from "./tools/tool-execution-types.ts";
import {
  AgentToolExecutor,
  type AgentToolRequestContext,
} from "./tools/tool-executor.ts";

export type AgentOrchestratorOptions = {
  modelName?: string;
  store?: AgentSessionStore;
  trackAnalysis?: TrackAnalysisOrchestrator;
};

type AgentInvocation = {
  content: string;
  toolCalls: ToolExecution[];
};

type AgentMessageInterpretation = {
  action: "continue_current_session" | "start_new_session" | "ask_clarifying_question";
  tool: "analyze_track" | "search_remixes" | "none";
  requestedTrack: AgentTrackReference | null;
  requestedGenre: string | null;
  usesCurrentFocus: boolean;
  reason: string;
};

const RECENT_MESSAGE_LIMIT = 8;
const RELEVANT_TOOL_RESULT_LIMIT = 4;
const logAgentOrchestrator = createScopedLogger("agent-orchestrator");

export class AgentOrchestrator {
  private readonly store: AgentSessionStore;
  private readonly trackAnalysis: TrackAnalysisOrchestrator;
  private readonly toolExecutor: AgentToolExecutor;
  private readonly modelName: string;
  private readonly apiKey: string;

  constructor(options: AgentOrchestratorOptions = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required for the agent runtime.");
    }

    this.store = options.store ?? new AgentSessionStore();
    this.trackAnalysis =
      options.trackAnalysis ?? new TrackAnalysisOrchestrator();
    this.toolExecutor = new AgentToolExecutor(
      this.store,
      this.trackAnalysis,
    );
    this.modelName = options.modelName ?? "gpt-5-nano";
    this.apiKey = apiKey;
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

    const interpretation = await this.interpretMessage(session, trimmed);
    const targetSession = this.resolveSessionForMessage(
      session,
      trimmed,
      interpretation,
    );
    const targetSessionId = targetSession.id;
    logAgentOrchestrator("message received", {
      requestedSessionId: sessionId,
      targetSessionId,
      createdNewSession: targetSessionId !== sessionId,
      content: trimmed,
      interpretation,
      context: this.buildLogContext(targetSessionId),
    });
    const requestMessage = this.store.addMessage({
      sessionId: targetSessionId,
      role: "user",
      content: trimmed,
    });

    const invocation = await this.invokeLlmAgent(
      targetSessionId,
      requestMessage,
      trimmed,
      interpretation,
    );
    logAgentOrchestrator("message planned", {
      sessionId: targetSessionId,
      toolCalls: invocation.toolCalls.map(({ call }) => ({
        id: call.id,
        toolName: call.toolName,
        status: call.status,
        arguments: call.arguments,
      })),
      context: this.buildLogContext(targetSessionId),
    });

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
    interpretation: AgentMessageInterpretation,
  ): Promise<AgentInvocation> {
    const toolCalls: ToolExecution[] = [];
    const tools = this.toolExecutor.createTools({
      sessionId,
      requestMessageId: requestMessage.id,
      executions: toolCalls,
      requestContext: interpretationToToolRequestContext(interpretation),
    });
    const systemPrompt = this.buildSystemPrompt(sessionId);
    const messages = this.buildLlmMessages(sessionId);
    logAgentOrchestrator("llm agent prompt", {
      sessionId,
      requestMessageId: requestMessage.id,
      systemPrompt,
      messages: messages.map((message) => ({
        type: message.getType(),
        content: message.content,
      })),
      context: this.buildLogContext(sessionId),
    });
    const agent = createAgent({
      model: new ChatOpenAI({ model: this.modelName, apiKey: this.apiKey }),
      tools,
      systemPrompt,
    });

    try {
      const result = await agent.invoke({
        messages,
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

      logAgentOrchestrator("llm agent failed without tool calls", {
        sessionId,
        requestMessageId: requestMessage.id,
        content,
        error: error instanceof Error ? error.message : "Unknown LLM agent error",
        context: this.buildLogContext(sessionId),
      });
      return {
        content:
          "I could not interpret that request reliably. Please ask for track analysis or remix search with the track title and artist.",
        toolCalls: [],
      };
    }
  }

  private async interpretMessage(
    session: AgentSession,
    content: string,
  ): Promise<AgentMessageInterpretation> {
    try {
      const model = new ChatOpenAI({
        model: this.modelName,
        apiKey: this.apiKey,
      });
      const systemPrompt = `You classify Track Lab agent messages before tool execution.
Return only strict JSON.
Track Lab has only these user-facing tools:
- analyze_track: analyze/enrich metadata for one explicit track.
- search_remixes: search remixes/edits/flips/bootlegs/VIPs/reworks for one track.

Sessions are focused workspaces around one current track.
If the user explicitly names a different track than the current focus, return action "start_new_session".
If the user refers to this track, it, same song, or asks a follow-up about the current focus, return action "continue_current_session" and usesCurrentFocus true.
For remix searches, extract requestedGenre from natural language when present, such as bass, house, techno, dubstep, drum and bass, trance, melodic, hardstyle, or similar style words.
If the request cannot be satisfied with these tools, return tool "none".
Do not infer provider-specific tools.`;
      const payload = {
        currentSession: {
          id: session.id,
          title: session.title,
          metadata: session.metadata,
        },
        recentMessages: this.store
          .listMessages(session.id)
          .slice(-RECENT_MESSAGE_LIMIT)
          .map((message) => ({
            role: message.role,
            content: message.content,
            metadata: message.metadata,
          })),
        userMessage: content,
        requiredShape: {
          action:
            "continue_current_session | start_new_session | ask_clarifying_question",
          tool: "analyze_track | search_remixes | none",
          requestedTrack: {
            title: "string",
            artists: "string",
            spotifyUrl: "string | null",
            genre: "string | null",
          },
          requestedGenre: "string | null",
          usesCurrentFocus: "boolean",
          reason: "short diagnostic reason",
        },
      };
      logAgentOrchestrator("llm interpretation prompt", {
        sessionId: session.id,
        systemPrompt,
        payload,
      });
      const response = await model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(JSON.stringify(payload)),
      ]);
      const parsed = parseJsonObject(getMessageContent(response));
      const interpretation = normalizeInterpretation(parsed);
      logAgentOrchestrator("message interpreted by llm", {
        sessionId: session.id,
        content,
        interpretation,
        context: {
          metadata: session.metadata,
        },
      });
      return interpretation;
    } catch (error) {
      logAgentOrchestrator("message interpretation failed", {
        sessionId: session.id,
        content,
        error: error instanceof Error ? error.message : "Unknown interpretation error",
      });
      throw new Error("The agent could not interpret the message with the LLM.");
    }
  }

  private resolveSessionForMessage(
    session: AgentSession,
    content: string,
    interpretation: AgentMessageInterpretation,
  ) {
    const requestedTrack = interpretation.requestedTrack;
    if (!requestedTrack?.title || !requestedTrack.artists) {
      logAgentOrchestrator("session routing kept", {
        sessionId: session.id,
        reason: interpretation.reason || "no explicit track reference",
        content,
        interpretation,
        context: {
          metadata: session.metadata,
        },
      });
      return session;
    }

    const focusTrack = session.metadata.currentFocusTrack;
    if (interpretation.action !== "start_new_session") {
      logAgentOrchestrator("session routing kept", {
        sessionId: session.id,
        reason: interpretation.reason || "LLM chose current session",
        requestedTrack,
        interpretation,
        context: {
          metadata: session.metadata,
        },
      });
      return session;
    }

    if (!focusTrack || sameTrack(focusTrack, requestedTrack)) {
      logAgentOrchestrator("session routing kept", {
        sessionId: session.id,
        reason: focusTrack ? "same focus track" : "no current focus track",
        requestedTrack,
        interpretation,
        context: {
          metadata: session.metadata,
        },
      });
      return session;
    }

    const nextSession = this.store.createSession(
      `${requestedTrack.title} by ${requestedTrack.artists}`,
    );
    logAgentOrchestrator("session routing split", {
      previousSessionId: session.id,
      nextSessionId: nextSession.id,
      previousFocusTrack: focusTrack,
      requestedTrack,
      interpretation,
      content,
    });

    return nextSession;
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

  private buildLogContext(sessionId: number) {
    const session = this.store.getSession(sessionId);
    const recentMessages = this.store
      .listMessages(sessionId)
      .slice(-RECENT_MESSAGE_LIMIT)
      .map((message) => ({
        role: message.role,
        content: message.content,
        metadata: message.metadata,
      }));
    const relevantToolResults = this.store
      .listToolCalls(sessionId)
      .filter((call) => call.status === "completed")
      .slice(-RELEVANT_TOOL_RESULT_LIMIT)
      .map(summarizeToolCallForContext);

    return {
      session: session
        ? {
            id: session.id,
            title: session.title,
            metadata: session.metadata,
          }
        : null,
      recentMessages,
      relevantToolResults,
    };
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
    | { candidates?: unknown[]; originalTrack?: unknown; requestedGenre?: unknown; job?: unknown }
    | null;

  return {
    toolName: call.toolName,
    arguments: call.arguments,
    result: {
      originalTrack: result?.originalTrack,
      requestedGenre: result?.requestedGenre ?? null,
      candidateCount: result?.candidates?.length ?? 0,
      job: result?.job,
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

function normalizeInterpretation(value: unknown): AgentMessageInterpretation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      action: "continue_current_session",
      tool: "none",
      requestedTrack: null,
      requestedGenre: null,
      usesCurrentFocus: false,
      reason: "LLM returned no parseable interpretation.",
    };
  }

  const record = value as Record<string, unknown>;
  const action = getInterpretationAction(record.action);
  const tool = getInterpretationTool(record.tool);
  const requestedTrack = getRequestedTrack(record.requestedTrack);

  return {
    action,
    tool,
    requestedTrack,
    requestedGenre: getNonEmptyString(record.requestedGenre),
    usesCurrentFocus: record.usesCurrentFocus === true,
    reason:
      typeof record.reason === "string" && record.reason.trim()
        ? record.reason.trim()
        : "No reason provided.",
  };
}

function interpretationToToolRequestContext(
  interpretation: AgentMessageInterpretation,
): AgentToolRequestContext {
  return {
    requestedTrack: interpretation.requestedTrack,
    requestedGenre:
      interpretation.requestedGenre ?? interpretation.requestedTrack?.genre ?? null,
    usesCurrentFocus: interpretation.usesCurrentFocus,
    tool: interpretation.tool,
  };
}

function getInterpretationAction(
  value: unknown,
): AgentMessageInterpretation["action"] {
  return value === "start_new_session" ||
    value === "ask_clarifying_question" ||
    value === "continue_current_session"
    ? value
    : "continue_current_session";
}

function getInterpretationTool(value: unknown): AgentMessageInterpretation["tool"] {
  return value === "analyze_track" ||
    value === "search_remixes" ||
    value === "none"
    ? value
    : "none";
}

function getRequestedTrack(value: unknown): AgentTrackReference | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const title = getNonEmptyString(record.title);
  const artists = getNonEmptyString(record.artists);
  if (!title || !artists) {
    return null;
  }

  return {
    title,
    artists,
    spotifyUrl: getNonEmptyString(record.spotifyUrl),
    genre: getNonEmptyString(record.genre),
  };
}

function parseJsonObject(value: string | null) {
  if (!value) {
    return null;
  }

  const fencedJson = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fencedJson ?? value;

  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function getMessageContent(message: unknown) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return null;
  }

  const content = (message as Record<string, unknown>).content;
  return typeof content === "string" ? content : null;
}

function getNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
