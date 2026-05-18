import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { createPrismaDatastoreClient, type PrismaDatastoreClient } from "./prisma-datastore-client.ts";
import { getDefaultDatabasePath } from "./db-path.ts";
import type { TrackResultRow } from "./types.ts";

type TrackResultMigrationClient = PrismaDatastoreClient & {
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
  $disconnect?: () => Promise<void>;
};

export type TrackResultMigrationSummary = {
  sourcePath: string;
  importedCount: number;
  skippedCount: number;
};

export type TrackResultMigrationOptions = {
  sourceDatabasePath?: string;
  prismaClient?: TrackResultMigrationClient;
};

export async function migrateTrackResults(
  options: TrackResultMigrationOptions = {},
): Promise<TrackResultMigrationSummary> {
  const sourcePath = options.sourceDatabasePath ?? getDefaultDatabasePath();

  if (!existsSync(sourcePath)) {
    return {
      sourcePath,
      importedCount: 0,
      skippedCount: 0,
    };
  }

  const sourceDb = new DatabaseSync(sourcePath, {
    readOnly: true,
  });
  const client = options.prismaClient ?? createPrismaDatastoreClient();
  let importedCount = 0;
  let skippedCount = 0;

  try {
    const rows = readRows<TrackResultRow>(sourceDb, "track_results");

    for (const row of rows) {
      try {
        await client.trackResult.upsert({
          where: {
            titleKey_artistsKey: {
              titleKey: row.title_key,
              artistsKey: row.artists_key,
            },
          },
          create: toPrismaTrackResultData(row, true) as any,
          update: toPrismaTrackResultData(row, false) as any,
        });

        importedCount += 1;
      } catch (error) {
        skippedCount += 1;
        console.warn("[track-results-migrate] skipped row", {
          id: row.id,
          error: error instanceof Error ? error.message : "Unknown migration error",
        });
      }
    }

    return {
      sourcePath,
      importedCount,
      skippedCount,
    };
  } finally {
    sourceDb.close();

    if (!options.prismaClient) {
      await client.$disconnect?.();
    }
  }
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
  const summary = await migrateTrackResults();

  console.log(
    `Migrated ${summary.importedCount} track_results rows from ${summary.sourcePath}.`,
  );
}
