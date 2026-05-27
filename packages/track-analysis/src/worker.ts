import { randomUUID } from "node:crypto";
import { invokeMetadataEnrichment } from "@track-lab/metadata-enrichment";
import { createScopedLogger } from "@track-lab/logger";
import {
  createEventLogRepository,
  createTrackAnalysisJobRepository,
  createTrackAnalysisQueueProvider,
  type EventLogRepository,
  type TrackAnalysisJobRepository,
  type TrackAnalysisJob,
  type TrackAnalysisPayload,
  type TrackAnalysisQueueMessage,
  type TrackAnalysisQueueProvider,
} from "@track-lab/datastore";
import type {
  AnalyzeTrackCommand,
  TrackAnalysisCompletedEvent,
  TrackAnalysisDomainEvent,
  TrackAnalysisFailedEvent,
  TrackAnalysisStartedEvent,
} from "@track-lab/api-types";
import { RemixSearchOrchestrator } from "@track-lab/remix-search";
import { createTrackAnalysisPrompt } from "./prompts/track-analysis-prompt.ts";

export type TrackAnalysisProcessor = (
  payload: TrackAnalysisPayload,
) => Promise<unknown>;

export type TrackAnalysisWorkerOptions = {
  pollIntervalMs?: number;
  jobTimeoutMs?: number;
  processor?: TrackAnalysisProcessor;
  onError?: (error: unknown) => void;
};

export class TrackAnalysisWorker {
  private stopped = false;
  private readonly jobs: TrackAnalysisJobRepository;
  private readonly queue: TrackAnalysisQueueProvider;
  private readonly events: EventLogRepository;
  private readonly options: TrackAnalysisWorkerOptions;
  private readonly log = createScopedLogger("track-analysis-worker");

  constructor(
    jobs = createTrackAnalysisJobRepository(),
    options: TrackAnalysisWorkerOptions = {},
    queue = createTrackAnalysisQueueProvider(),
    events: EventLogRepository = createEventLogRepository(),
  ) {
    this.jobs = jobs;
    this.options = options;
    this.queue = queue;
    this.events = events;
  }

  async processNextJob(): Promise<TrackAnalysisJob | null> {
    if (this.queue.mode === "sqs") {
      return this.processNextQueueMessage();
    }

    return this.processNextDatabaseJob();
  }

  private async processNextDatabaseJob(): Promise<TrackAnalysisJob | null> {
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

      await this.emitTrackAnalysisStarted(job);
      const result = await this.processPayload(job.payload as TrackAnalysisPayload);
      await this.emitTrackAnalysisCompleted(job);
      const completed = await this.jobs.completeJob(job.id, result);
      this.log("completed queued job", {
        jobId: job.id,
        operation: job.operation,
      });
      return completed;
    } catch (error) {
      await this.emitTrackAnalysisFailed(job, error);
      const failed = await this.jobs.deadLetterJob(job.id, getErrorMessage(error));
      this.log("failed queued job", {
        jobId: job.id,
        operation: job.operation,
        status: failed?.status,
        error: getErrorMessage(error),
      });
      this.options.onError?.(error);
      return failed;
    }
  }

  private async processNextQueueMessage(): Promise<TrackAnalysisJob | null> {
    const message = await this.queue.receiveNextMessage();

    if (!message) {
      return this.processNextDatabaseJob();
    }

    this.log("received sqs message", {
      messageId: message.messageId,
    });

    const command = parseAnalyzeTrackCommandFromMessage(message);
    const jobId = command?.payload.jobId ?? parseJobIdFromMessage(message);

    if (jobId === null) {
      this.options.onError?.(new Error("Invalid SQS job message body."));
      this.log("discarded invalid sqs message", {
        messageId: message.messageId,
      });
      await this.queue.deleteMessage(message);
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

    if (
      currentJob.status === "completed" ||
      currentJob.status === "failed" ||
      currentJob.status === "dead_lettered"
    ) {
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
      await this.emitTrackAnalysisStarted(claimed, command);
      const result = await this.processPayload(claimed.payload as TrackAnalysisPayload);
      await this.emitTrackAnalysisCompleted(claimed, command);
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
      await this.emitTrackAnalysisFailed(claimed, error, command);
      const failed = await this.jobs.deadLetterJob(claimed.id, getErrorMessage(error));
      this.log("failed sqs job", {
        messageId: message.messageId,
        jobId: claimed.id,
        operation: claimed.operation,
        status: failed?.status,
        error: getErrorMessage(error),
      });

      await this.handleFailedSqsMessage(message, claimed.id, failed);
      this.options.onError?.(error);
      return failed;
    }
  }

  private async processPayload(payload: TrackAnalysisPayload): Promise<unknown> {
    const processor = this.options.processor ?? processTrackAnalysisPayload;
    const timeoutMs = this.options.jobTimeoutMs ?? 4 * 60 * 1000;

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return processor(payload);
    }

    return withTimeout(
      processor(payload),
      timeoutMs,
      `Track analysis job timed out after ${timeoutMs}ms.`,
    );
  }

  private async handleFailedSqsMessage(
    message: TrackAnalysisQueueMessage,
    jobId: number,
    failed: TrackAnalysisJob | null,
  ) {
    if (!failed) {
      return;
    }

    if (failed.status === "dead_lettered" || failed.status === "failed") {
      try {
        await this.queue.deleteMessage(message);
        this.log("deleted sqs message after terminal failure", {
          messageId: message.messageId,
          jobId,
          status: failed.status,
        });
      } catch (deleteError) {
        this.options.onError?.(deleteError);
        this.log("failed to delete sqs message after terminal failure", {
          messageId: message.messageId,
          jobId,
          status: failed.status,
          error: getErrorMessage(deleteError),
        });
      }
    }
  }

  private async emitTrackAnalysisStarted(
    job: TrackAnalysisJob,
    command?: AnalyzeTrackCommand | null,
  ) {
    if (job.payload.operation !== "analyze") {
      return;
    }

    await this.appendEvent({
      eventId: randomUUID(),
      eventType: "TrackAnalysisStarted",
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: getCorrelationId(job, command),
      causationId: getCausationId(job, command),
      producer: "apps/worker",
      idempotencyKey: `track-analysis-job:${job.id}:attempt:${job.attemptCount}:started`,
      payload: {
        jobId: job.id,
        track: job.payload.track,
        status: "analyzing",
      },
    } satisfies TrackAnalysisStartedEvent);
  }

  private async emitTrackAnalysisCompleted(
    job: TrackAnalysisJob,
    command?: AnalyzeTrackCommand | null,
  ) {
    if (job.payload.operation !== "analyze") {
      return;
    }

    await this.appendEvent({
      eventId: randomUUID(),
      eventType: "TrackAnalysisCompleted",
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: getCorrelationId(job, command),
      causationId: getCausationId(job, command),
      producer: "apps/worker",
      idempotencyKey: `track-analysis-job:${job.id}:attempt:${job.attemptCount}:completed`,
      payload: {
        jobId: job.id,
        status: "completed",
      },
    } satisfies TrackAnalysisCompletedEvent);
  }

  private async emitTrackAnalysisFailed(
    job: TrackAnalysisJob,
    error: unknown,
    command?: AnalyzeTrackCommand | null,
  ) {
    if (job.payload.operation !== "analyze") {
      return;
    }

    await this.appendEvent({
      eventId: randomUUID(),
      eventType: "TrackAnalysisFailed",
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: getCorrelationId(job, command),
      causationId: getCausationId(job, command),
      producer: "apps/worker",
      idempotencyKey: `track-analysis-job:${job.id}:attempt:${job.attemptCount}:failed`,
      payload: {
        jobId: job.id,
        status: "failed",
        errorMessage: getErrorMessage(error),
      },
    } satisfies TrackAnalysisFailedEvent);
  }

  private async appendEvent(event: TrackAnalysisDomainEvent) {
    await this.events.append(event);
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
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

function parseAnalyzeTrackCommandFromMessage(
  message: TrackAnalysisQueueMessage,
): AnalyzeTrackCommand | null {
  try {
    const parsed = JSON.parse(message.body) as Partial<AnalyzeTrackCommand>;
    if (
      parsed.commandType === "AnalyzeTrackCommand" &&
      typeof parsed.commandId === "string" &&
      typeof parsed.correlationId === "string" &&
      parsed.payload &&
      typeof parsed.payload === "object" &&
      typeof (parsed.payload as { jobId?: unknown }).jobId === "number"
    ) {
      return parsed as AnalyzeTrackCommand;
    }
  } catch {
    return null;
  }

  return null;
}

function getCorrelationId(
  job: TrackAnalysisJob,
  command?: AnalyzeTrackCommand | null,
): string {
  return command?.correlationId ?? job.correlationId ?? randomUUID();
}

function getCausationId(
  job: TrackAnalysisJob,
  command?: AnalyzeTrackCommand | null,
): string | undefined {
  return command?.commandId ?? job.commandId ?? undefined;
}
