import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { createPrismaDatastoreClient, type PrismaDatastoreClient } from "./prisma-datastore-client.ts";
import { getDefaultDatabasePath } from "./db-path.ts";
import type {
  AgentMessageRow,
  AgentSessionRow,
  AgentToolCallRow,
  EnqueueTrackAnalysisJobInput,
  SavedRemixRow,
  TrackAnalysisJobRow,
  TrackResultRow,
} from "./types.ts";

type MigrationTableSummary = {
  importedCount: number;
  skippedCount: number;
};

export type DatastoreMigrationSummary = {
  sourcePath: string;
  trackResults: MigrationTableSummary;
  remixResults: MigrationTableSummary;
  agentSessions: MigrationTableSummary;
  agentMessages: MigrationTableSummary;
  agentToolCalls: MigrationTableSummary;
  trackAnalysisJobs: MigrationTableSummary;
};

type PrismaMigrationClient = PrismaDatastoreClient & {
  trackResult: {
    upsert(args: {
      where: {
        titleKey_artistsKey: {
          titleKey: string;
          artistsKey: string;
        };
      };
      create: any;
      update: any;
    }): Promise<unknown>;
  };
  remixResult: {
    upsert(args: {
      where: {
        provider_link: {
          provider: string;
          link: string;
        };
      };
      create: any;
      update: any;
    }): Promise<unknown>;
  };
  agentSession: {
    upsert(args: {
      where: { id: number };
      create: any;
      update: any;
    }): Promise<unknown>;
  };
  agentMessage: {
    upsert(args: {
      where: { id: number };
      create: any;
      update: any;
    }): Promise<unknown>;
  };
  agentToolCall: {
    upsert(args: {
      where: { id: number };
      create: any;
      update: any;
    }): Promise<unknown>;
  };
  trackAnalysisJob: {
    upsert(args: {
      where: { id: number };
      create: any;
      update: any;
    }): Promise<unknown>;
  };
  $executeRawUnsafe(query: string): Promise<unknown>;
  $disconnect?: () => Promise<void>;
};

export type DatastoreMigrationOptions = {
  sourceDatabasePath?: string;
  prismaClient?: PrismaMigrationClient;
};

export async function migrateDatastore(
  options: DatastoreMigrationOptions = {},
): Promise<DatastoreMigrationSummary> {
  const sourcePath = options.sourceDatabasePath ?? getDefaultDatabasePath();

  if (!existsSync(sourcePath)) {
    return emptySummary(sourcePath);
  }

  const sourceDb = new DatabaseSync(sourcePath, {
    readOnly: true,
  });
  const client = options.prismaClient ?? createPrismaDatastoreClient();

  try {
    const trackResults = await migrateTrackResults(sourceDb, client);
    const remixResults = await migrateRemixResults(sourceDb, client);
    const agentSessions = await migrateAgentSessions(sourceDb, client);
    const agentMessages = await migrateAgentMessages(sourceDb, client);
    const agentToolCalls = await migrateAgentToolCalls(sourceDb, client);
    const trackAnalysisJobs = await migrateTrackAnalysisJobs(sourceDb, client);

    await resetSequences(client);

    return {
      sourcePath,
      trackResults,
      remixResults,
      agentSessions,
      agentMessages,
      agentToolCalls,
      trackAnalysisJobs,
    };
  } finally {
    sourceDb.close();

    if (!options.prismaClient) {
      await client.$disconnect?.();
    }
  }
}

function emptySummary(sourcePath: string): DatastoreMigrationSummary {
  const summary = { importedCount: 0, skippedCount: 0 };
  return {
    sourcePath,
    trackResults: summary,
    remixResults: summary,
    agentSessions: summary,
    agentMessages: summary,
    agentToolCalls: summary,
    trackAnalysisJobs: summary,
  };
}

async function migrateTrackResults(
  sourceDb: DatabaseSync,
  client: PrismaMigrationClient,
): Promise<MigrationTableSummary> {
  const rows = readRows<TrackResultRow>(sourceDb, "track_results");

  return migrateRows(rows, async (row) => {
    await client.trackResult.upsert({
      where: {
        titleKey_artistsKey: {
          titleKey: row.title_key,
          artistsKey: row.artists_key,
        },
      },
      create: toPrismaTrackResultData(row, true),
      update: toPrismaTrackResultData(row, false),
    });
  }, "track_results");
}

async function migrateRemixResults(
  sourceDb: DatabaseSync,
  client: PrismaMigrationClient,
): Promise<MigrationTableSummary> {
  const rows = readRows<SavedRemixRow>(sourceDb, "remix_results");

  return migrateRows(rows, async (row) => {
    await client.remixResult.upsert({
      where: {
        provider_link: {
          provider: row.provider,
          link: row.link,
        },
      },
      create: toPrismaRemixResultData(row, true),
      update: toPrismaRemixResultData(row, false),
    });
  }, "remix_results");
}

async function migrateAgentSessions(
  sourceDb: DatabaseSync,
  client: PrismaMigrationClient,
): Promise<MigrationTableSummary> {
  const rows = readRows<AgentSessionRow>(sourceDb, "agent_sessions");

  return migrateRows(rows, async (row) => {
    await client.agentSession.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        title: row.title,
        metadataJson: row.metadata_json,
        createdAt: parseSqliteTimestamp(row.created_at),
        updatedAt: parseSqliteTimestamp(row.updated_at),
      },
      update: {
        title: row.title,
        metadataJson: row.metadata_json,
        createdAt: parseSqliteTimestamp(row.created_at),
        updatedAt: parseSqliteTimestamp(row.updated_at),
      },
    });
  }, "agent_sessions");
}

async function migrateAgentMessages(
  sourceDb: DatabaseSync,
  client: PrismaMigrationClient,
): Promise<MigrationTableSummary> {
  const rows = readRows<AgentMessageRow>(sourceDb, "agent_messages");

  return migrateRows(rows, async (row) => {
    await client.agentMessage.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        sessionId: row.session_id,
        role: row.role,
        content: row.content,
        metadataJson: row.metadata_json,
        createdAt: parseSqliteTimestamp(row.created_at),
      },
      update: {
        sessionId: row.session_id,
        role: row.role,
        content: row.content,
        metadataJson: row.metadata_json,
        createdAt: parseSqliteTimestamp(row.created_at),
      },
    });
  }, "agent_messages");
}

async function migrateAgentToolCalls(
  sourceDb: DatabaseSync,
  client: PrismaMigrationClient,
): Promise<MigrationTableSummary> {
  const rows = readRows<AgentToolCallRow>(sourceDb, "agent_tool_calls");

  return migrateRows(rows, async (row) => {
    await client.agentToolCall.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        sessionId: row.session_id,
        requestMessageId: row.request_message_id,
        assistantMessageId: row.assistant_message_id,
        toolCallId: row.tool_call_id,
        toolName: row.tool_name,
        argumentsJson: row.arguments_json,
        status: row.status,
        resultJson: row.result_json,
        errorMessage: row.error_message,
        startedAt: parseSqliteTimestamp(row.started_at),
        completedAt: row.completed_at ? parseSqliteTimestamp(row.completed_at) : null,
      },
      update: {
        sessionId: row.session_id,
        requestMessageId: row.request_message_id,
        assistantMessageId: row.assistant_message_id,
        toolCallId: row.tool_call_id,
        toolName: row.tool_name,
        argumentsJson: row.arguments_json,
        status: row.status,
        resultJson: row.result_json,
        errorMessage: row.error_message,
        startedAt: parseSqliteTimestamp(row.started_at),
        completedAt: row.completed_at ? parseSqliteTimestamp(row.completed_at) : null,
      },
    });
  }, "agent_tool_calls");
}

async function migrateTrackAnalysisJobs(
  sourceDb: DatabaseSync,
  client: PrismaMigrationClient,
): Promise<MigrationTableSummary> {
  const rows = readRows<TrackAnalysisJobRow>(sourceDb, "track_analysis_jobs");

  return migrateRows(rows, async (row) => {
    await client.trackAnalysisJob.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        operation: row.operation,
        status: row.status,
        payloadJson: row.payload_json,
        resultJson: row.result_json,
        errorMessage: row.error_message,
        attemptCount: row.attempt_count,
        maxAttempts: row.max_attempts,
        createdAt: parseSqliteTimestamp(row.created_at),
        updatedAt: parseSqliteTimestamp(row.updated_at),
        completedAt: row.completed_at ? parseSqliteTimestamp(row.completed_at) : null,
        notificationReadAt: row.notification_read_at
          ? parseSqliteTimestamp(row.notification_read_at)
          : null,
        resolvedAt: row.resolved_at ? parseSqliteTimestamp(row.resolved_at) : null,
      },
      update: {
        operation: row.operation,
        status: row.status,
        payloadJson: row.payload_json,
        resultJson: row.result_json,
        errorMessage: row.error_message,
        attemptCount: row.attempt_count,
        maxAttempts: row.max_attempts,
        createdAt: parseSqliteTimestamp(row.created_at),
        updatedAt: parseSqliteTimestamp(row.updated_at),
        completedAt: row.completed_at ? parseSqliteTimestamp(row.completed_at) : null,
        notificationReadAt: row.notification_read_at
          ? parseSqliteTimestamp(row.notification_read_at)
          : null,
        resolvedAt: row.resolved_at ? parseSqliteTimestamp(row.resolved_at) : null,
      },
    });
  }, "track_analysis_jobs");
}

async function migrateRows<T extends { id: number }>(
  rows: T[],
  migrateRow: (row: T) => Promise<void>,
  tableName: string,
): Promise<MigrationTableSummary> {
  let importedCount = 0;
  let skippedCount = 0;

  for (const row of rows) {
    try {
      await migrateRow(row);
      importedCount += 1;
    } catch (error) {
      skippedCount += 1;
      console.warn(`[datastore-migrate] skipped ${tableName} row ${row.id}`, {
        error: error instanceof Error ? error.message : "Unknown migration error",
      });
    }
  }

  return { importedCount, skippedCount };
}

function readRows<T>(sourceDb: DatabaseSync, tableName: string): T[] {
  try {
    return sourceDb.prepare(`SELECT * FROM ${tableName} ORDER BY id ASC`).all() as T[];
  } catch (error) {
    if (error instanceof Error && error.message.includes("no such table")) {
      return [];
    }

    throw error;
  }
}

async function resetSequences(client: PrismaMigrationClient) {
  const tables = [
    "track_results",
    "remix_results",
    "agent_sessions",
    "agent_messages",
    "agent_tool_calls",
    "track_analysis_jobs",
  ] as const;

  for (const table of tables) {
    await client.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('${table}', 'id'),
        COALESCE((SELECT MAX(id) FROM "${table}"), 1),
        EXISTS (SELECT 1 FROM "${table}")
      )
    `);
  }
}

function toPrismaTrackResultData(
  row: TrackResultRow,
  includeId: boolean,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    title: row.title,
    artists: row.artists,
    album: row.album,
    titleKey: row.title_key,
    artistsKey: row.artists_key,
    bpm: row.bpm,
    genre: row.genre,
    subGenre: row.sub_genre,
    trackKey: row.track_key,
    summary: row.summary,
    status: row.status,
    providersUsedJson: row.providers_used_json,
    errorsJson: row.errors_json,
    responseJson: row.response_json,
    rawResponse: row.raw_response,
    createdAt: parseSqliteTimestamp(row.created_at),
    updatedAt: parseSqliteTimestamp(row.updated_at),
  };

  if (includeId) {
    data.id = row.id;
  }

  return data;
}

function toPrismaRemixResultData(
  row: SavedRemixRow,
  includeId: boolean,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    provider: row.provider,
    link: row.link,
    title: row.title,
    artists: row.artists,
    remixArtist: row.remix_artist,
    album: row.album,
    genre: row.genre,
    subGenre: row.sub_genre,
    bpm: row.bpm,
    uploadedAt: row.uploaded_at,
    durationMs: row.duration_ms,
    confidence: row.confidence,
    relevanceReason: row.relevance_reason,
    originalTrackJson: row.original_track_json,
    requestedGenre: row.requested_genre,
    candidateJson: row.candidate_json,
    savedAt: parseSqliteTimestamp(row.saved_at),
    updatedAt: parseSqliteTimestamp(row.updated_at),
  };

  if (includeId) {
    data.id = row.id;
  }

  return data;
}

function parseSqliteTimestamp(value: string) {
  const normalized = value.includes("T")
    ? value
    : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`Invalid SQLite timestamp: ${value}`);
  }

  return parsed;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const summary = await migrateDatastore();

  console.log(
    JSON.stringify(summary, null, 2),
  );
}
