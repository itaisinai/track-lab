import { invokeTrackMetadataAgent } from "@track-lab/agent";
import {
  TrackAnalysisJobStore,
  type TrackAnalysisJob,
  type TrackAnalysisPayload,
} from "@track-lab/datastore";

export type TrackAnalysisProcessor = (
  payload: TrackAnalysisPayload,
) => Promise<unknown>;

export type TrackAnalysisWorkerOptions = {
  pollIntervalMs?: number;
  processor?: TrackAnalysisProcessor;
  onError?: (error: unknown) => void;
};

export class TrackAnalysisWorker {
  private stopped = false;
  private readonly jobs: TrackAnalysisJobStore;
  private readonly options: TrackAnalysisWorkerOptions;

  constructor(
    jobs = new TrackAnalysisJobStore(),
    options: TrackAnalysisWorkerOptions = {},
  ) {
    this.jobs = jobs;
    this.options = options;
  }

  async processNextJob(): Promise<TrackAnalysisJob | null> {
    const job = this.jobs.claimNextJob();

    if (!job) {
      return null;
    }

    try {
      const result = await (this.options.processor ?? processTrackAnalysisPayload)(
        job.payload as TrackAnalysisPayload,
      );
      return this.jobs.completeJob(job.id, result);
    } catch (error) {
      const failed = this.jobs.failJob(job.id, getErrorMessage(error));
      this.options.onError?.(error);
      return failed;
    }
  }

  async start() {
    this.stopped = false;

    while (!this.stopped) {
      const processed = await this.processNextJob();

      if (!processed) {
        await delay(this.options.pollIntervalMs ?? 1500);
      }
    }
  }

  stop() {
    this.stopped = true;
  }
}

export async function processTrackAnalysisPayload(payload: TrackAnalysisPayload) {
  return invokeTrackMetadataAgent(
    `Title: ${payload.track.title}\nArtists: ${payload.track.artists}`,
    {
      operation: payload.operation,
      preferDatastore: payload.operation === "analyze",
      knownMetadata: payload.knownMetadata,
    },
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown worker error.";
}
