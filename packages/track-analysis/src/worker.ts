import { invokeMetadataEnrichment } from "@track-lab/metadata-enrichment";
import { createScopedLogger } from "@track-lab/logger";
import {
  createTrackAnalysisJobRepository,
  createTrackAnalysisQueueProvider,
  type TrackAnalysisJobRepository,
  type TrackAnalysisJob,
  type TrackAnalysisPayload,
  type TrackAnalysisQueueMessage,
  type TrackAnalysisQueueProvider,
} from "@track-lab/datastore";
import { RemixSearchOrchestrator } from "@track-lab/remix-search";
import { createTrackAnalysisPrompt } from "./prompts/track-analysis-prompt.ts";

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
  private readonly jobs: TrackAnalysisJobRepository;
  private readonly queue: TrackAnalysisQueueProvider;
  private readonly options: TrackAnalysisWorkerOptions;
  private readonly log = createScopedLogger("track-analysis-worker");

  constructor(
    jobs = createTrackAnalysisJobRepository(),
    options: TrackAnalysisWorkerOptions = {},
    queue = createTrackAnalysisQueueProvider(),
  ) {
    this.jobs = jobs;
    this.options = options;
    this.queue = queue;
  }

  async processNextJob(): Promise<TrackAnalysisJob | null> {
    if (this.queue.mode === "sqs") {
      return this.processNextQueueMessage();
    }

    const job = await this.jobs.claimNextJob();

    if (!job) {
      return null;
    }

    try {
      this.log("processing queued job", {
        jobId: job.id,
        operation: job.operation,
        status: job.status,
      });

      const result = await (this.options.processor ?? processTrackAnalysisPayload)(
        job.payload as TrackAnalysisPayload,
      );
      const completed = await this.jobs.completeJob(job.id, result);
      this.log("completed queued job", {
        jobId: job.id,
        operation: job.operation,
      });
      return completed;
    } catch (error) {
      const failed = await this.jobs.failJob(job.id, getErrorMessage(error));
      this.log("failed queued job", {
        jobId: job.id,
        operation: job.operation,
        error: getErrorMessage(error),
      });
      this.options.onError?.(error);
      return failed;
    }
  }

  private async processNextQueueMessage(): Promise<TrackAnalysisJob | null> {
    const message = await this.queue.receiveNextMessage();

    if (!message) {
      return null;
    }

    this.log("received sqs message", {
      messageId: message.messageId,
    });

    const jobId = parseJobIdFromMessage(message);

    if (jobId === null) {
      this.options.onError?.(new Error("Invalid SQS job message body."));
      this.log("discarded invalid sqs message", {
        messageId: message.messageId,
      });
      return null;
    }

    const currentJob = await this.jobs.getJob(jobId);

    if (!currentJob) {
      await this.queue.deleteMessage(message);
      this.log("deleted sqs message for missing job", {
        messageId: message.messageId,
        jobId,
      });
      return null;
    }

    if (currentJob.status === "completed" || currentJob.status === "dead_lettered") {
      await this.queue.deleteMessage(message);
      this.log("deleted sqs message for terminal job", {
        messageId: message.messageId,
        jobId,
        status: currentJob.status,
      });
      return currentJob;
    }

    const claimed = await this.jobs.claimJob(jobId);

    if (!claimed) {
      this.log("skipped unclaimable sqs job", {
        messageId: message.messageId,
        jobId,
      });
      return null;
    }

    this.log("claimed sqs job", {
      messageId: message.messageId,
      jobId: claimed.id,
      operation: claimed.operation,
      status: claimed.status,
    });

    try {
      const result = await (this.options.processor ?? processTrackAnalysisPayload)(
        claimed.payload as TrackAnalysisPayload,
      );
      const completed = await this.jobs.completeJob(claimed.id, result);
      this.log("completed sqs job", {
        messageId: message.messageId,
        jobId: claimed.id,
        operation: claimed.operation,
      });

      try {
        await this.queue.deleteMessage(message);
        this.log("deleted sqs message after success", {
          messageId: message.messageId,
          jobId: claimed.id,
        });
      } catch (deleteError) {
        this.options.onError?.(deleteError);
        this.log("failed to delete sqs message after success", {
          messageId: message.messageId,
          jobId: claimed.id,
          error: getErrorMessage(deleteError),
        });
      }

      return completed;
    } catch (error) {
      const failed = await this.jobs.failJob(claimed.id, getErrorMessage(error));
      this.log("failed sqs job", {
        messageId: message.messageId,
        jobId: claimed.id,
        operation: claimed.operation,
        error: getErrorMessage(error),
      });
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
  if (payload.operation === "remix_search") {
    return new RemixSearchOrchestrator().search(payload.request);
  }

  return invokeMetadataEnrichment(
    createTrackAnalysisPrompt(payload),
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

function parseJobIdFromMessage(message: TrackAnalysisQueueMessage): number | null {
  try {
    const parsed = JSON.parse(message.body) as { jobId?: unknown };

    if (typeof parsed.jobId !== "number" || !Number.isInteger(parsed.jobId)) {
      return null;
    }

    return parsed.jobId;
  } catch {
    return null;
  }
}
