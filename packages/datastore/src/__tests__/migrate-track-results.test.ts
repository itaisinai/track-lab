import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { migrateTrackResults } from "../migrate-track-results.ts";

test("migrateTrackResults copies sqlite rows into the postgres repository", async () => {
  const databasePath = join(mkdtempSync(join(tmpdir(), "track-lab-")), "db.sqlite");
  const db = new DatabaseSync(databasePath);

  db.exec(`
    CREATE TABLE track_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artists TEXT NOT NULL,
      album TEXT,
      title_key TEXT NOT NULL,
      artists_key TEXT NOT NULL,
      bpm REAL,
      genre TEXT,
      sub_genre TEXT,
      track_key TEXT,
      summary TEXT,
      status TEXT NOT NULL,
      providers_used_json TEXT NOT NULL,
      errors_json TEXT NOT NULL,
      response_json TEXT NOT NULL,
      raw_response TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(title_key, artists_key)
    )
  `);

  db.prepare(`
    INSERT INTO track_results (
      id,
      title,
      artists,
      album,
      title_key,
      artists_key,
      bpm,
      genre,
      sub_genre,
      track_key,
      summary,
      status,
      providers_used_json,
      errors_json,
      response_json,
      raw_response,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    17,
    "Strobe",
    "deadmau5",
    "For Lack of a Better Name",
    "strobe",
    "deadmau5",
    128,
    "Progressive House",
    "Progressive House",
    "F#m",
    "A long-form progressive house classic.",
    "complete",
    JSON.stringify([
      { name: "Spotify", matched: true, url: "https://open.spotify.com/track/1", error: null },
    ]),
    "[]",
    JSON.stringify({ title: "Strobe" }),
    "{}",
    "2026-05-17T10:00:00.000Z",
    "2026-05-17T10:15:00.000Z",
  );
  db.close();

  const calls: Array<Record<string, unknown>> = [];
  const summary = await migrateTrackResults({
    sourceDatabasePath: databasePath,
    prismaClient: {
      trackResult: {
        upsert: async (args: Record<string, unknown>) => {
          calls.push(args as Record<string, unknown>);
          return null;
        },
      },
      $disconnect: async () => {},
    } as never,
  });

  assert.equal(summary.importedCount, 1);
  assert.equal(summary.skippedCount, 0);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]?.where, {
    titleKey_artistsKey: {
      titleKey: "strobe",
      artistsKey: "deadmau5",
    },
  });

  const create = calls[0]?.create as Record<string, unknown>;
  const update = calls[0]?.update as Record<string, unknown>;

  assert.equal(create?.id, 17);
  assert.equal((create?.createdAt as Date).toISOString(), "2026-05-17T10:00:00.000Z");
  assert.equal((create?.updatedAt as Date).toISOString(), "2026-05-17T10:15:00.000Z");
  assert.equal(update?.id, undefined);
});
