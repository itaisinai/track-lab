import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./prisma-client.ts";
import { getDefaultDatabasePath } from "./db-path.ts";
import { TrackResultStore } from "./track-result-store.ts";

type SqliteTrackResultRow = {
  id: number;
  title: string;
  artists: string;
  album: string | null;
  title_key: string;
  artists_key: string;
  bpm: number | null;
  genre: string | null;
  sub_genre: string | null;
  track_key: string | null;
  summary: string | null;
  status: string;
  providers_used_json: string;
  errors_json: string;
  response_json: string;
  raw_response: string;
  created_at: string;
  updated_at: string;
};

type TrackResultMigrationClient = {
  trackResult: {
    upsert(args: {
      where: {
        titleKey_artistsKey: {
          titleKey: string;
          artistsKey: string;
        };
      };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
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

  const sourceStore = new TrackResultStore(sourcePath);
  const client =
    options.prismaClient ?? createTrackResultMigrationClient();
  let importedCount = 0;
  let skippedCount = 0;

  try {
    const rows = sourceStore.db.prepare(
      "SELECT * FROM track_results ORDER BY id ASC",
    ).all() as SqliteTrackResultRow[];

    if (rows.length === 0) {
      return {
        sourcePath,
        importedCount: 0,
        skippedCount: 0,
      };
    }

    for (const row of rows) {
      await client.trackResult.upsert({
        where: {
          titleKey_artistsKey: {
            titleKey: row.title_key,
            artistsKey: row.artists_key,
          },
        },
        create: toPrismaTrackResultData(row),
        update: toPrismaTrackResultData(row, false),
      });

      importedCount += 1;
    }

    return {
      sourcePath,
      importedCount,
      skippedCount,
    };
  } finally {
    sourceStore.db.close();

    if (!options.prismaClient) {
      await client.$disconnect?.();
    }
  }
}

function createTrackResultMigrationClient(): TrackResultMigrationClient {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to migrate track results.");
  }

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });

  return new PrismaClient({ adapter }) as unknown as TrackResultMigrationClient;
}

function toPrismaTrackResultData(
  row: SqliteTrackResultRow,
  includeId = true,
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
