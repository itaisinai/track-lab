import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getDefaultDatabasePath } from "./db-path.ts";
import { parseJson } from "./lib/json.ts";
import type {
  EnqueueTrackAnalysisJobInput,
  TrackAnalysisJob,
  TrackAnalysisJobRow,
  TrackAnalysisPayload,
  TrackAnalysisJobStatus,
} from "./types.ts";

const TERMINAL_STATUSES = new Set<TrackAnalysisJobStatus>([
  "completed",
  "failed",
  "dead_lettered",
]);

export class TrackAnalysisJobStore {
  readonly db: DatabaseSync;

  constructor(databasePath = getDefaultDatabasePath()) {
    const resolvedPath = resolve(databasePath);
    mkdirSync(dirname(resolvedPath), { recursive: true });
    this.db = new DatabaseSync(resolvedPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.createJobsTable();
    this.ensureRemixSearchOperation();
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_track_analysis_jobs_status_created
      ON track_analysis_jobs(status, created_at, id)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_track_analysis_jobs_unresolved
      ON track_analysis_jobs(resolved_at, completed_at, id)
    `);
  }

  private createJobsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS track_analysis_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL CHECK (operation IN ('analyze', 'enrich', 'remix_search')),
        status TEXT NOT NULL CHECK (
          status IN ('queued', 'processing', 'completed', 'failed', 'dead_lettered')
        ),
        payload_json TEXT NOT NULL,
        result_json TEXT,
        error_message TEXT,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        notification_read_at TEXT,
        resolved_at TEXT
      )
    `);
  }

  private ensureRemixSearchOperation() {
    const row = this.db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'track_analysis_jobs'",
      )
      .get() as { sql: string } | undefined;

    if (!row?.sql || row.sql.includes("'remix_search'")) {
      return;
    }

    this.db.exec("DROP INDEX IF EXISTS idx_track_analysis_jobs_status_created");
    this.db.exec("DROP INDEX IF EXISTS idx_track_analysis_jobs_unresolved");
    this.db.exec("ALTER TABLE track_analysis_jobs RENAME TO track_analysis_jobs_legacy");
    this.createJobsTable();
    this.db.exec(`
      INSERT INTO track_analysis_jobs (
        id,
        operation,
        status,
        payload_json,
        result_json,
        error_message,
        attempt_count,
        max_attempts,
        created_at,
        updated_at,
        completed_at,
        notification_read_at,
        resolved_at
      )
      SELECT
        id,
        operation,
        status,
        payload_json,
        result_json,
        error_message,
        attempt_count,
        max_attempts,
        created_at,
        updated_at,
        completed_at,
        notification_read_at,
        resolved_at
      FROM track_analysis_jobs_legacy
    `);
    this.db.exec("DROP TABLE track_analysis_jobs_legacy");
  }

  enqueue(input: EnqueueTrackAnalysisJobInput): TrackAnalysisJob {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(`
        INSERT INTO track_analysis_jobs (
          operation,
          status,
          payload_json,
          attempt_count,
          max_attempts,
          created_at,
          updated_at
        ) VALUES (?, 'queued', ?, 0, ?, ?, ?)
      `)
      .run(
        input.operation,
        JSON.stringify(input.payload),
        input.maxAttempts ?? 3,
        now,
        now,
      );

    return this.getJob(Number(result.lastInsertRowid)) as TrackAnalysisJob;
  }

  listJobs(options: {
    statuses?: TrackAnalysisJobStatus[];
    unresolvedOnly?: boolean;
    unreadOnly?: boolean;
  } = {}): TrackAnalysisJob[] {
    const filters: string[] = [];
    const params: string[] = [];

    if (options.statuses?.length) {
      filters.push(`status IN (${options.statuses.map(() => "?").join(", ")})`);
      params.push(...options.statuses);
    }

    if (options.unresolvedOnly) {
      filters.push("resolved_at IS NULL");
      filters.push("status IN ('completed', 'failed', 'dead_lettered')");
    }

    if (options.unreadOnly) {
      filters.push("notification_read_at IS NULL");
      filters.push("status IN ('completed', 'failed', 'dead_lettered')");
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = this.db
      .prepare(`SELECT * FROM track_analysis_jobs ${where} ORDER BY updated_at DESC, id DESC`)
      .all(...params) as TrackAnalysisJobRow[];

    return rows.map(mapRowToTrackAnalysisJob);
  }

  getJob(id: number): TrackAnalysisJob | null {
    const row = this.db
      .prepare("SELECT * FROM track_analysis_jobs WHERE id = ?")
      .get(id) as TrackAnalysisJobRow | undefined;

    return row ? mapRowToTrackAnalysisJob(row) : null;
  }

  claimNextJob(): TrackAnalysisJob | null {
    const now = new Date().toISOString();

    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.db
        .prepare(`
          SELECT * FROM track_analysis_jobs
          WHERE status = 'queued'
          ORDER BY created_at ASC, id ASC
          LIMIT 1
        `)
        .get() as TrackAnalysisJobRow | undefined;

      if (!row) {
        this.db.exec("COMMIT");
        return null;
      }

      this.db
        .prepare(`
          UPDATE track_analysis_jobs
          SET status = 'processing',
              attempt_count = attempt_count + 1,
              error_message = NULL,
              updated_at = ?
          WHERE id = ?
        `)
        .run(now, row.id);

      this.db.exec("COMMIT");
      return this.getJob(row.id);
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  completeJob(id: number, result: unknown): TrackAnalysisJob | null {
    const now = new Date().toISOString();
    this.db
      .prepare(`
        UPDATE track_analysis_jobs
        SET status = 'completed',
            result_json = ?,
            error_message = NULL,
            updated_at = ?,
            completed_at = ?
        WHERE id = ?
      `)
      .run(JSON.stringify(result), now, now, id);

    return this.getJob(id);
  }

  failJob(id: number, errorMessage: string): TrackAnalysisJob | null {
    const job = this.getJob(id);

    if (!job) {
      return null;
    }

    const now = new Date().toISOString();
    const status: TrackAnalysisJobStatus =
      job.attemptCount >= job.maxAttempts ? "dead_lettered" : "queued";
    const completedAt = TERMINAL_STATUSES.has(status) ? now : null;

    this.db
      .prepare(`
        UPDATE track_analysis_jobs
        SET status = ?,
            error_message = ?,
            updated_at = ?,
            completed_at = ?
        WHERE id = ?
      `)
      .run(status, errorMessage, now, completedAt, id);

    return this.getJob(id);
  }

  retryJob(id: number): TrackAnalysisJob | null {
    const job = this.getJob(id);

    if (!job || (job.status !== "failed" && job.status !== "dead_lettered")) {
      return null;
    }

    const now = new Date().toISOString();
    this.db
      .prepare(`
        UPDATE track_analysis_jobs
        SET status = 'queued',
            error_message = NULL,
            completed_at = NULL,
            updated_at = ?
        WHERE id = ?
      `)
      .run(now, id);

    return this.getJob(id);
  }

  markNotificationRead(id: number): TrackAnalysisJob | null {
    const now = new Date().toISOString();
    this.db
      .prepare(`
        UPDATE track_analysis_jobs
        SET notification_read_at = COALESCE(notification_read_at, ?),
            updated_at = ?
        WHERE id = ?
      `)
      .run(now, now, id);

    return this.getJob(id);
  }

  resolveJob(id: number): TrackAnalysisJob | null {
    const now = new Date().toISOString();
    this.db
      .prepare(`
        UPDATE track_analysis_jobs
        SET resolved_at = COALESCE(resolved_at, ?),
            updated_at = ?
        WHERE id = ?
      `)
      .run(now, now, id);

    return this.getJob(id);
  }
}

function mapRowToTrackAnalysisJob(row: TrackAnalysisJobRow): TrackAnalysisJob {
  return {
    id: row.id,
    operation: row.operation,
    status: row.status,
    payload: parseJson(row.payload_json) as TrackAnalysisPayload,
    result: row.result_json ? parseJson(row.result_json) : null,
    errorMessage: row.error_message,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    notificationReadAt: row.notification_read_at,
    resolvedAt: row.resolved_at,
  };
}
