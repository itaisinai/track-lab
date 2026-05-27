export type DomainEvent<TPayload = unknown> = {
  eventId: string;
  eventType: string;
  version: number;
  occurredAt: string;
  correlationId: string;
  causationId?: string;
  producer: string;
  idempotencyKey: string;
  payload: TPayload;
};

export type TrackAnalysisStartedPayload = {
  jobId: number;
  track: {
    title: string;
    artists: string;
  };
  status: "analyzing";
};

export type TrackAnalysisCompletedPayload = {
  jobId: number;
  status: "completed";
};

export type TrackAnalysisFailedPayload = {
  jobId: number;
  status: "failed";
  errorMessage: string;
};

export type TrackAnalysisStartedEvent =
  DomainEvent<TrackAnalysisStartedPayload> & {
    eventType: "TrackAnalysisStarted";
  };

export type TrackAnalysisCompletedEvent =
  DomainEvent<TrackAnalysisCompletedPayload> & {
    eventType: "TrackAnalysisCompleted";
  };

export type TrackAnalysisFailedEvent =
  DomainEvent<TrackAnalysisFailedPayload> & {
    eventType: "TrackAnalysisFailed";
  };

export type TrackAnalysisDomainEvent =
  | TrackAnalysisStartedEvent
  | TrackAnalysisCompletedEvent
  | TrackAnalysisFailedEvent;
