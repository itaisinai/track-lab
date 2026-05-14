import type {
  AgentMessage,
} from "@track-lab/api-types";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { AgentSessionStore } from "@track-lab/datastore";
import { RemixSearchOrchestrator } from "@track-lab/remix-search";
import { TrackAnalysisOrchestrator } from "@track-lab/track-analysis";
import { createAgent } from "langchain";
import { AGENT_SYSTEM_PROMPT } from "./prompts/agent-system-prompt.ts";
import {
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

    const requestMessage = this.store.addMessage({
      sessionId,
      role: "user",
      content: trimmed,
    });

    const invocation = this.useLlm
      ? await this.invokeLlmAgent(sessionId, requestMessage, trimmed)
      : await this.invokeLocalPlanner(sessionId, requestMessage, trimmed);

    const metadata = buildAssistantMetadata(invocation.toolCalls);
    const assistantMessage = this.store.addMessage({
      sessionId,
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
      session: this.store.getSession(sessionId),
      messages: this.store.listMessages(sessionId),
      toolCalls: this.store.listToolCalls(sessionId),
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
      systemPrompt: AGENT_SYSTEM_PROMPT,
    });

    try {
      const result = await agent.invoke({
        messages: [new HumanMessage(content)],
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
      const input = parseRemixRequest(content);

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

}
