export type Command<TPayload = unknown> = {
  commandId: string;
  commandType: string;
  version: number;
  requestedAt: string;
  correlationId: string;
  producer: string;
  idempotencyKey: string;
  payload: TPayload;
};

export type AnalyzeTrackCommandPayload = {
  jobId: number;
  track: {
    title: string;
    artists: string;
  };
};

export type AnalyzeTrackCommand = Command<AnalyzeTrackCommandPayload> & {
  commandType: "AnalyzeTrackCommand";
};
