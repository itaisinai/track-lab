import type {
  AgentMessage,
  AgentSession,
  AgentToolCall,
  AgentTrackReference,
} from "@track-lab/api-types";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import {
  createAgentSessionRepository,
  type AgentSessionRepository,
} from "@track-lab/datastore";
import { createScopedLogger } from "@track-lab/logger";
import { TrackAnalysisOrchestrator } from "@track-lab/track-analysis";
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
  store?: AgentSessionRepository;
  trackAnalysis?: TrackAnalysisOrchestrator;
};

type AgentInvocation = {
  content: string;
  toolCalls: ToolExecution[];
};

type AgentMessageInterpretation = {
  action:
    | "continue_current_session"
    | "start_new_session"
    | "ask_clarifying_question";
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
  private readonly store: AgentSessionRepository;
  private readonly trackAnalysis: TrackAnalysisOrchestrator;
  private readonly toolExecutor: AgentToolExecutor;
  private readonly modelName: string;
  private readonly apiKey: string;

  constructor(options: AgentOrchestratorOptions = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required for the agent orchestrator.");
    }

    this.store = options.store ?? createAgentSessionRepository();
    this.trackAnalysis =
      options.trackAnalysis ?? new TrackAnalysisOrchestrator();
    this.toolExecutor = new AgentToolExecutor(this.store, this.trackAnalysis);
    this.modelName = options.modelName ?? "gpt-5-nano";
    this.apiKey = apiKey;
  }

  async sendMessage(sessionId: number, content: string) {
    const session = await this.store.getSession(sessionId);

    if (!session) {
      throw new Error("Agent session was not found.");
    }

    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error("Message content is required.");
    }

    const interpretation = await this.interpretMessage(session, trimmed);
    const targetSession = await this.resolveSessionForMessage(
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
      context: await this.buildLogContext(targetSessionId),
    });
    const requestMessage = await this.store.addMessage({
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
      context: await this.buildLogContext(targetSessionId),
    });

    const metadata = buildAssistantMetadata(invocation.toolCalls);
    const assistantMessage = await this.store.addMessage({
      sessionId: targetSessionId,
      role: "assistant",
      content: invocation.content,
      metadata,
    });
    await this.store.attachToolCallsToAssistantMessage(
      invocation.toolCalls.map(({ call }) => call.id),
      assistantMessage.id,
    );

    return {
      message: assistantMessage,
      session: await this.store.getSession(targetSessionId),
      messages: await this.store.listMessages(targetSessionId),
      toolCalls: await this.store.listToolCalls(targetSessionId),
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
    const systemPrompt = await this.buildSystemPrompt(sessionId);
    const messages = await this.buildLlmMessages(sessionId);
    logAgentOrchestrator("llm agent prompt", {
      sessionId,
      requestMessageId: requestMessage.id,
      systemPrompt,
      messages: messages.map((message) => ({
        type: message.getType(),
        content: message.content,
      })),
      context: await this.buildLogContext(sessionId),
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
        context: await this.buildLogContext(sessionId),
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
      const recentMessages = (await this.store.listMessages(session.id))
        .slice(-RECENT_MESSAGE_LIMIT)
        .map((message) => ({
          role: message.role,
          content: message.content,
          metadata: message.metadata,
        }));
      const payload = {
        currentSession: {
          id: session.id,
          title: session.title,
          metadata: session.metadata,
        },
        recentMessages,
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

  private async resolveSessionForMessage(
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

    const nextSession = await this.store.createSession(
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

  private async buildSystemPrompt(sessionId: number) {
    const session = await this.store.getSession(sessionId);
    const relevantToolResults = (await this.store.listToolCalls(sessionId))
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

  private async buildLogContext(sessionId: number) {
    const session = await this.store.getSession(sessionId);
    const recentMessages = (await this.store.listMessages(sessionId))
      .slice(-RECENT_MESSAGE_LIMIT)
      .map((message) => ({
        role: message.role,
        content: message.content,
        metadata: message.metadata,
      }));
    const relevantToolResults = (await this.store.listToolCalls(sessionId))
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

  private async buildLlmMessages(sessionId: number) {
    return (await this.store.listMessages(sessionId))
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

function interpretationToToolRequestContext(
  interpretation: AgentMessageInterpretation,
): AgentToolRequestContext {
  return {
    requestedTrack: interpretation.requestedTrack,
    requestedGenre: interpretation.requestedGenre,
    usesCurrentFocus: interpretation.usesCurrentFocus,
    tool: interpretation.tool,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown agent orchestrator error.";
}

function getMessageContent(message: { content: unknown }) {
  return typeof message.content === "string" ? message.content : "";
}

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore
  }

  throw new Error("LLM response was not valid JSON.");
}

function normalizeInterpretation(record: Record<string, unknown>): AgentMessageInterpretation {
  const requestedTrack = normalizeRequestedTrack(record.requestedTrack);

  return {
    action: normalizeString(record.action, [
      "continue_current_session",
      "start_new_session",
      "ask_clarifying_question",
    ]) as AgentMessageInterpretation["action"] ?? "ask_clarifying_question",
    tool: normalizeString(record.tool, ["analyze_track", "search_remixes", "none"]) as AgentMessageInterpretation["tool"] ?? "none",
    requestedTrack,
    requestedGenre: normalizeOptionalString(record.requestedGenre),
    usesCurrentFocus: typeof record.usesCurrentFocus === "boolean"
      ? record.usesCurrentFocus
      : false,
    reason: normalizeOptionalString(record.reason) ?? "",
  };
}

function normalizeRequestedTrack(value: unknown): AgentTrackReference | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const title = normalizeOptionalString(record.title);
  const artists = normalizeOptionalString(record.artists);

  if (!title || !artists) {
    return null;
  }

  return {
    title,
    artists,
    spotifyUrl: normalizeNullableString(record.spotifyUrl),
    genre: normalizeNullableString(record.genre),
  };
}

function normalizeString(value: unknown, allowed: string[]) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return allowed.includes(trimmed) ? trimmed : null;
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeNullableString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeOptionalString(value);
}

function summarizeToolCallForContext(call: AgentToolCall) {
  return {
    id: call.id,
    toolName: call.toolName,
    status: call.status,
    result: call.result,
    errorMessage: call.errorMessage,
  };
}
