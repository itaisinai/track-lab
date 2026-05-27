import type { AnalyzeTrackCommand } from "@track-lab/api-types";
import type { MaybePromise } from "./repository.ts";

export type TrackAnalysisQueueProviderMode = "database" | "sqs";

export type TrackAnalysisQueueMessage = {
  body: string;
  messageId?: string;
  receiptHandle?: string;
};

export type TrackAnalysisQueueCommand = AnalyzeTrackCommand | number;

export interface TrackAnalysisQueueProvider {
  readonly mode: TrackAnalysisQueueProviderMode;
  enqueue(command: TrackAnalysisQueueCommand): MaybePromise<void>;
  receiveNextMessage(): MaybePromise<TrackAnalysisQueueMessage | null>;
  deleteMessage(message: TrackAnalysisQueueMessage): MaybePromise<void>;
}
