import { Prisma } from "./prisma-client.ts";
import type {
  EnqueueTrackAnalysisJobInput,
  TrackAnalysisJob,
  TrackAnalysisJobStatus,
  TrackAnalysisPayload,
} from "./types.ts";
import { parseJson } from "./lib/json.ts";
import type { TrackAnalysisJobRepository } from "./track-analysis-job-repository.ts";
import { createPrismaDatastoreClient, type PrismaDatastoreClient } from "./prisma-datastore-client.ts";

type PrismaTrackAnalysisJobRow = {
  id: number;
  operation: string;
  status: string;
  payloadJson: string;
  resultJson: string | null;
  errorMessage: string | null;
  attemptCount: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  notificationReadAt: Date | null;
  resolvedAt: Date | null;
};

type PrismaTrackAnalysisJobDelegate = {
  create(args: {
    data: Record<string, unknown>;
  }): Promise<PrismaTrackAnalysisJobRow>;
  findMany(args: {
    where?: Record<string, unknown>;
    orderBy: Array<Record<string, unknown>>;
  }): Promise<PrismaTrackAnalysisJobRow[]>;
  findUnique(args: {
    where: { id: number };
  }): Promise<PrismaTrackAnalysisJobRow | null>;
  update(args: {
    where: { id: number };
    data: Record<string, unknown>;
  }): Promise<PrismaTrackAnalysisJobRow>;
};

type PrismaTrackAnalysisJobClaimRow = {
  id: number;
  operation: string;
  status: string;
  payload_json: string;
  result_json: string | null;
  error_message: string | null;
  attempt_count: number;
  max_attempts: number;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
  notification_read_at: Date | null;
  resolved_at: Date | null;
};

type PrismaTrackAnalysisJobTransactionClient = PrismaDatastoreClient & {
  trackAnalysisJob: PrismaTrackAnalysisJobDelegate;
};

export type PrismaTrackAnalysisJobClient = PrismaDatastoreClient & {
  trackAnalysisJob: PrismaTrackAnalysisJobDelegate;
  $transaction<T>(callback: (client: PrismaTrackAnalysisJobTransactionClient) => Promise<T>): Promise<T>;
};

export type PrismaTrackAnalysisJobRepositoryOptions = {
  client?: PrismaTrackAnalysisJobClient;
};

const TERMINAL_STATUSES = new Set<TrackAnalysisJobStatus>([
  "completed",
  "failed",
  "dead_lettered",
]);
const CLAIM_LEASE_MS = 5 * 60 * 1000;

export class PrismaTrackAnalysisJobRepository implements TrackAnalysisJobRepository {
  private readonly client: PrismaTrackAnalysisJobClient;

  constructor(options: PrismaTrackAnalysisJobRepositoryOptions = {}) {
    this.client = options.client ?? (createPrismaDatastoreClient() as PrismaTrackAnalysisJobClient);
  }

  async enqueue(input: EnqueueTrackAnalysisJobInput): Promise<TrackAnalysisJob> {
    const now = new Date();
    const row = await this.client.trackAnalysisJob.create({
      data: {
        operation: input.operation,
        status: "queued",
        payloadJson: JSON.stringify(input.payload),
        resultJson: null,
        errorMessage: null,
        attemptCount: 0,
        maxAttempts: input.maxAttempts ?? 3,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        notificationReadAt: null,
        resolvedAt: null,
      },
    });

    return mapRowToTrackAnalysisJob(row);
  }

  async listJobs(options: {
    statuses?: TrackAnalysisJobStatus[];
    unresolvedOnly?: boolean;
    unreadOnly?: boolean;
  } = {}): Promise<TrackAnalysisJob[]> {
    const filters: Record<string, unknown>[] = [];

    if (options.statuses?.length) {
      filters.push({
        status: {
          in: options.statuses,
        },
      });
    }

    if (options.unresolvedOnly) {
      filters.push({
        resolvedAt: null,
      });
      filters.push({
        status: {
          in: ["completed", "failed", "dead_lettered"],
        },
      });
    }

    if (options.unreadOnly) {
      filters.push({
        notificationReadAt: null,
      });
      filters.push({
        status: {
          in: ["completed", "failed", "dead_lettered"],
        },
      });
    }

    const rows = await this.client.trackAnalysisJob.findMany({
      where: filters.length ? { AND: filters } : undefined,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });

    return rows.map(mapRowToTrackAnalysisJob);
  }

  async getJob(id: number): Promise<TrackAnalysisJob | null> {
    const row = await this.client.trackAnalysisJob.findUnique({ where: { id } });
    return row ? mapRowToTrackAnalysisJob(row) : null;
  }

  async claimNextJob(): Promise<TrackAnalysisJob | null> {
    const staleCutoff = new Date(Date.now() - CLAIM_LEASE_MS);

    return this.client.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<Array<PrismaTrackAnalysisJobClaimRow>>(Prisma.sql`
          WITH next_job AS (
            SELECT id
            FROM track_analysis_jobs
            WHERE status = 'queued'
               OR (status = 'processing' AND updated_at <= ${staleCutoff})
            ORDER BY
              CASE WHEN status = 'queued' THEN 0 ELSE 1 END,
              created_at ASC,
              id ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          )
          UPDATE track_analysis_jobs AS job
          SET status = 'processing',
              attempt_count = job.attempt_count + 1,
              error_message = NULL,
              updated_at = NOW()
          FROM next_job
          WHERE job.id = next_job.id
          RETURNING
            job.id,
            job.operation,
            job.status,
            job.payload_json,
            job.result_json,
            job.error_message,
            job.attempt_count,
            job.max_attempts,
            job.created_at,
            job.updated_at,
            job.completed_at,
            job.notification_read_at,
            job.resolved_at
        `);

        const row = rows[0];
        return row ? mapClaimRowToTrackAnalysisJob(row) : null;
      },
      {
        maxWait: 20_000,
        timeout: 60_000,
      },
    );
  }

  async claimJob(id: number): Promise<TrackAnalysisJob | null> {
    const staleCutoff = new Date(Date.now() - CLAIM_LEASE_MS);

    return this.client.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<Array<PrismaTrackAnalysisJobClaimRow>>(Prisma.sql`
          WITH target AS (
            SELECT id
            FROM track_analysis_jobs
            WHERE id = ${id}
              AND (
                status = 'queued'
                OR (status = 'processing' AND updated_at <= ${staleCutoff})
              )
            FOR UPDATE SKIP LOCKED
          )
          UPDATE track_analysis_jobs AS job
          SET status = 'processing',
              attempt_count = job.attempt_count + 1,
              error_message = NULL,
              updated_at = NOW()
          FROM target
          WHERE job.id = target.id
          RETURNING
            job.id,
            job.operation,
            job.status,
            job.payload_json,
            job.result_json,
            job.error_message,
            job.attempt_count,
            job.max_attempts,
            job.created_at,
            job.updated_at,
            job.completed_at,
            job.notification_read_at,
            job.resolved_at
        `);

        const row = rows[0];
        return row ? mapClaimRowToTrackAnalysisJob(row) : null;
      },
      {
        maxWait: 20_000,
        timeout: 60_000,
      },
    );
  }

  async completeJob(id: number, result: unknown): Promise<TrackAnalysisJob | null> {
    const row = await this.client.trackAnalysisJob.update({
      where: { id },
      data: {
        status: "completed",
        resultJson: JSON.stringify(result),
        errorMessage: null,
        updatedAt: new Date(),
        completedAt: new Date(),
      },
    });

    return mapRowToTrackAnalysisJob(row);
  }

  async failJob(id: number, errorMessage: string): Promise<TrackAnalysisJob | null> {
    const job = await this.getJob(id);

    if (!job) {
      return null;
    }

    const now = new Date();
    const status: TrackAnalysisJobStatus =
      job.attemptCount >= job.maxAttempts ? "dead_lettered" : "queued";
    const completedAt = TERMINAL_STATUSES.has(status) ? now : null;

    const row = await this.client.trackAnalysisJob.update({
      where: { id },
      data: {
        status,
        errorMessage,
        updatedAt: now,
        completedAt,
      },
    });

    return mapRowToTrackAnalysisJob(row);
  }

  async deadLetterJob(id: number, errorMessage: string): Promise<TrackAnalysisJob | null> {
    const job = await this.getJob(id);

    if (!job) {
      return null;
    }

    const now = new Date();
    const row = await this.client.trackAnalysisJob.update({
      where: { id },
      data: {
        status: "dead_lettered",
        errorMessage,
        updatedAt: now,
        completedAt: now,
      },
    });

    return mapRowToTrackAnalysisJob(row);
  }

  async retryJob(id: number): Promise<TrackAnalysisJob | null> {
    const job = await this.getJob(id);

    if (
      !job ||
      !(
        job.status === "failed" ||
        job.status === "dead_lettered" ||
        (job.status === "processing" && isLeaseExpired(job.updatedAt))
      )
    ) {
      return null;
    }

    const row = await this.client.trackAnalysisJob.update({
      where: { id },
      data: {
        status: "queued",
        errorMessage: null,
        completedAt: null,
        updatedAt: new Date(),
      },
    });

    return mapRowToTrackAnalysisJob(row);
  }

  async markNotificationRead(id: number): Promise<TrackAnalysisJob | null> {
    const job = await this.getJob(id);

    if (!job) {
      return null;
    }

    const now = new Date();
    const row = await this.client.trackAnalysisJob.update({
      where: { id },
      data: {
        notificationReadAt: job.notificationReadAt ? new Date(job.notificationReadAt) : now,
        updatedAt: now,
      },
    });

    return mapRowToTrackAnalysisJob(row);
  }

  async resolveJob(id: number): Promise<TrackAnalysisJob | null> {
    const job = await this.getJob(id);

    if (!job) {
      return null;
    }

    const now = new Date();
    const row = await this.client.trackAnalysisJob.update({
      where: { id },
      data: {
        resolvedAt: job.resolvedAt ? new Date(job.resolvedAt) : now,
        updatedAt: now,
      },
    });

    return mapRowToTrackAnalysisJob(row);
  }
}

function isLeaseExpired(updatedAt: string): boolean {
  return new Date(updatedAt).valueOf() <= Date.now() - CLAIM_LEASE_MS;
}

function mapRowToTrackAnalysisJob(row: PrismaTrackAnalysisJobRow): TrackAnalysisJob {
  return {
    id: row.id,
    operation: row.operation as TrackAnalysisJob["operation"],
    status: row.status as TrackAnalysisJobStatus,
    payload: parseJson(row.payloadJson) as TrackAnalysisPayload,
    result: row.resultJson ? parseJson(row.resultJson) : null,
    errorMessage: row.errorMessage,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    notificationReadAt: row.notificationReadAt ? row.notificationReadAt.toISOString() : null,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
  };
}

function mapClaimRowToTrackAnalysisJob(
  row: PrismaTrackAnalysisJobClaimRow,
): TrackAnalysisJob {
  return {
    id: row.id,
    operation: row.operation as TrackAnalysisJob["operation"],
    status: row.status as TrackAnalysisJobStatus,
    payload: parseJson(row.payload_json) as TrackAnalysisPayload,
    result: row.result_json ? parseJson(row.result_json) : null,
    errorMessage: row.error_message,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
    notificationReadAt: row.notification_read_at
      ? row.notification_read_at.toISOString()
      : null,
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
  };
}
