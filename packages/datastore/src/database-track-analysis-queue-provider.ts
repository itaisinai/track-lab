import type {
  TrackAnalysisQueueMessage,
  TrackAnalysisQueueProvider,
} from "./track-analysis-queue-provider.ts";

export class DatabaseTrackAnalysisQueueProvider implements TrackAnalysisQueueProvider {
  readonly mode = "database" as const;

  async enqueue(_jobId: number): Promise<void> {}

  async receiveNextMessage(): Promise<TrackAnalysisQueueMessage | null> {
    return null;
  }

  async deleteMessage(_message: TrackAnalysisQueueMessage): Promise<void> {}
}
