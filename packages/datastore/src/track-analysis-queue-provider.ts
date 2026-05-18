import type { MaybePromise } from "./repository.ts";

export type TrackAnalysisQueueProviderMode = "database" | "sqs";

export type TrackAnalysisQueueMessage = {
  body: string;
  messageId?: string;
  receiptHandle?: string;
};

export interface TrackAnalysisQueueProvider {
  readonly mode: TrackAnalysisQueueProviderMode;
  enqueue(jobId: number): MaybePromise<void>;
  receiveNextMessage(): MaybePromise<TrackAnalysisQueueMessage | null>;
  deleteMessage(message: TrackAnalysisQueueMessage): MaybePromise<void>;
}
