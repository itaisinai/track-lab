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
