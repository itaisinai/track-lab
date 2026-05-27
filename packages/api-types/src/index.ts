export type {
  AnalyzeTrackCommand,
  AnalyzeTrackCommandPayload,
  Command,
} from "./commands.ts";

export type {
  DomainEvent,
  TrackAnalysisCompletedEvent,
  TrackAnalysisCompletedPayload,
  TrackAnalysisDomainEvent,
  TrackAnalysisFailedEvent,
  TrackAnalysisFailedPayload,
  TrackAnalysisStartedEvent,
  TrackAnalysisStartedPayload,
} from "./events.ts";

export type {
  AgentMessage,
  AgentMessageMetadata,
  AgentMessageRole,
  AgentSession,
  AgentSessionMetadata,
  AgentTrackReference,
  AgentToolCall,
  AgentToolCallStatus,
  AgentToolInput,
  AgentToolName,
  AnalyzeTrackToolInput,
  CreateAgentSessionResponse,
  DeleteAgentSessionResponse,
  GetAgentSessionResponse,
  ListAgentSessionsResponse,
  SearchRemixesToolInput,
  SendAgentMessageRequest,
  SendAgentMessageResponse,
} from "./agent.ts";

export type {
  ListSavedResultsResponse,
  NormalizedTrackResult,
  ProviderStatus,
  ResultError,
  ResultStatus,
  SavedTrackResult,
  SaveTrackResultInput,
  SaveTrackResultResponse,
  TrackDetails,
} from "./results.ts";

export type {
  ListSavedRemixCandidatesResponse,
  RemixSearchCandidate,
  RemixSearchOriginalTrack,
  RemixSearchProvider,
  RemixSearchRequest,
  RemixSearchResponse,
  SavedRemixCandidate,
  SaveRemixCandidateRequest,
  SaveRemixCandidateResponse,
} from "./remix-search.ts";

export type {
  EnqueueRemixSearchResponse,
  EnqueueTrackAnalysisRequest,
  EnqueueTrackAnalysisResponse,
  ListTrackAnalysisJobsResponse,
  RemixSearchJobPayload,
  TrackAnalysisJob,
  TrackAnalysisJobResponse,
  TrackAnalysisJobStatus,
  TrackAnalysisKnownMetadata,
  TrackAnalysisOperation,
  TrackAnalysisPayload,
  TrackAnalysisSource,
  TrackMetadataAnalysisPayload,
} from "./track-analysis.ts";
