import type {
  AgentMessage,
  AgentMessageMetadata,
  AgentMessageRole,
  AgentSession,
  AgentSessionMetadata,
  AgentToolCall,
  AgentToolCallStatus,
  AgentToolInput,
  AgentToolName,
  TrackAnalysisJob,
} from "./types.ts";
import type { MaybePromise } from "./repository.ts";

export interface AgentSessionRepository {
  createSession(title?: string): MaybePromise<AgentSession>;
  listSessions(): MaybePromise<AgentSession[]>;
  getSession(id: number): MaybePromise<AgentSession | null>;
  deleteSession(id: number): MaybePromise<boolean>;
  updateSessionTitle(id: number, title: string): MaybePromise<AgentSession>;
  updateSessionMetadata(
    sessionId: number,
    metadata:
      | AgentSessionMetadata
      | ((current: AgentSessionMetadata) => AgentSessionMetadata),
  ): MaybePromise<AgentSession>;
  syncCompletedAnalysisJob(job: TrackAnalysisJob): MaybePromise<void>;
  listMessages(sessionId: number): MaybePromise<AgentMessage[]>;
  listToolCalls(sessionId: number): MaybePromise<AgentToolCall[]>;
  addMessage(input: {
    sessionId: number;
    role: AgentMessageRole;
    content: string;
    metadata?: AgentMessageMetadata;
  }): MaybePromise<AgentMessage>;
  startToolCall(input: {
    sessionId: number;
    requestMessageId: number;
    toolCallId?: string | null;
    toolName: AgentToolName;
    arguments: AgentToolInput;
  }): MaybePromise<AgentToolCall>;
  completeToolCall(id: number, result: unknown): MaybePromise<AgentToolCall | null>;
  failToolCall(id: number, errorMessage: string): MaybePromise<AgentToolCall | null>;
  attachToolCallsToAssistantMessage(
    toolCallIds: number[],
    assistantMessageId: number,
  ): MaybePromise<void>;
}
