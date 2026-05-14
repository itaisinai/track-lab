export type {
  AgentMessage,
  AgentSession,
  AgentToolCall,
  ProviderStatus,
  ResultError,
  RemixSearchCandidate,
  RemixSearchRequest,
  RemixSearchResponse,
  SavedRemixCandidate,
  SavedTrackResult,
  TrackAnalysisJob,
  TrackAnalysisJobStatus,
  TrackDetails,
} from "@track-lab/api-types";

export type View =
  | "enrich"
  | "remix-search"
  | "saved-remixes"
  | "results"
  | "review"
  | "datastore";
