import type { RemixSearchResponse } from "./remix-search.ts";
import type {
  TrackAnalysisJob,
  TrackAnalysisKnownMetadata,
  TrackAnalysisOperation,
} from "./track-analysis.ts";

export type AgentToolName = "analyze_track" | "search_remixes";

export type AgentMessageRole = "user" | "assistant";

export type AgentToolCallStatus = "running" | "completed" | "failed";

export type AnalyzeTrackToolInput = {
  title: string;
  artists: string;
  operation?: "analyze" | "enrich";
  knownMetadata?: TrackAnalysisKnownMetadata;
};

export type SearchRemixesToolInput = {
  title?: string | null;
  artists?: string | null;
  spotifyUrl?: string | null;
  genre?: string | null;
};

export type AgentToolInput = AnalyzeTrackToolInput | SearchRemixesToolInput;

export type AgentTrackReference = {
  title: string;
  artists: string;
  spotifyUrl?: string | null;
  genre?: string | null;
};

export type AgentSessionMetadata = Partial<{
  currentFocusTrack: AgentTrackReference;
  latestAnalyzedTrack: AgentTrackReference;
  latestAnalysisResult: unknown;
  latestTrackResultId: number;
  latestRemixSearchContext: {
    track: AgentTrackReference;
    requestedGenre?: string | null;
    resultCount?: number;
  };
}>;

export type AgentMessageMetadata = Partial<{
  analysisResult: unknown;
  queuedTrackAnalysisJob: Pick<TrackAnalysisJob, "id" | "status"> & {
    operation: TrackAnalysisOperation;
  };
  remixSearchResult: RemixSearchResponse;
  toolCallIds: number[];
  error: string;
}>;

export type AgentSession = {
  id: number;
  title: string;
  metadata: AgentSessionMetadata;
  createdAt: string;
  updatedAt: string;
};

export type AgentMessage = {
  id: number;
  sessionId: number;
  role: AgentMessageRole;
  content: string;
  metadata: AgentMessageMetadata;
  createdAt: string;
};

export type AgentToolCall = {
  id: number;
  sessionId: number;
  requestMessageId: number;
  assistantMessageId: number | null;
  toolCallId: string | null;
  toolName: AgentToolName;
  arguments: AgentToolInput;
  status: AgentToolCallStatus;
  result: unknown | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type CreateAgentSessionResponse = {
  session: AgentSession;
};

export type DeleteAgentSessionResponse = {
  sessionId: number;
};

export type ListAgentSessionsResponse = {
  sessions: AgentSession[];
};

export type GetAgentSessionResponse = {
  session: AgentSession;
  messages: AgentMessage[];
  toolCalls: AgentToolCall[];
};

export type SendAgentMessageRequest = {
  content: string;
};

export type SendAgentMessageResponse = GetAgentSessionResponse & {
  message: AgentMessage;
};
