import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { migrateDatastore } from "../migrate-datastore.ts";

test("migrateDatastore copies all sqlite datastore tables into postgres repositories", async () => {
  const databasePath = join(mkdtempSync(join(tmpdir(), "track-lab-migrate-")), "db.sqlite");
  createSourceDatabase(databasePath);

  const calls = createCallLog();
  const summary = await migrateDatastore({
    sourceDatabasePath: databasePath,
    prismaClient: calls.client as never,
  });

  assert.deepEqual(summary, {
    sourcePath: databasePath,
    trackResults: { importedCount: 1, skippedCount: 0 },
    remixResults: { importedCount: 1, skippedCount: 0 },
    agentSessions: { importedCount: 1, skippedCount: 0 },
    agentMessages: { importedCount: 2, skippedCount: 0 },
    agentToolCalls: { importedCount: 1, skippedCount: 0 },
    trackAnalysisJobs: { importedCount: 1, skippedCount: 0 },
  });

  assert.equal(calls.trackResult.length, 1);
  assert.equal(calls.remixResult.length, 1);
  assert.equal(calls.agentSession.length, 1);
  assert.equal(calls.agentMessage.length, 2);
  assert.equal(calls.agentToolCall.length, 1);
  assert.equal(calls.trackAnalysisJob.length, 1);

  assert.equal((calls.trackResult[0]?.create as Record<string, unknown>).id, 11);
  assert.equal(
    ((calls.trackResult[0]?.create as Record<string, unknown>).createdAt as Date).toISOString(),
    "2026-05-18T10:00:00.000Z",
  );
  assert.equal((calls.agentToolCall[0]?.create as Record<string, unknown>).requestMessageId, 22);
  assert.equal((calls.agentToolCall[0]?.create as Record<string, unknown>).assistantMessageId, 23);
  assert.equal((calls.trackAnalysisJob[0]?.create as Record<string, unknown>).id, 31);
  assert.equal(
    (calls.trackAnalysisJob[0]?.create as Record<string, unknown>).completedAt instanceof Date,
    true,
  );
});

function createSourceDatabase(databasePath: string) {
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
    );
    CREATE TABLE remix_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      link TEXT NOT NULL,
      title TEXT NOT NULL,
      artists TEXT NOT NULL,
      remix_artist TEXT,
      album TEXT,
      genre TEXT,
      sub_genre TEXT,
      bpm REAL,
      uploaded_at TEXT,
      duration_ms INTEGER,
      confidence REAL NOT NULL,
      relevance_reason TEXT NOT NULL,
      original_track_json TEXT NOT NULL,
      requested_genre TEXT,
      candidate_json TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(provider, link)
    );
    CREATE TABLE agent_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE agent_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
    );
    CREATE TABLE agent_tool_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      request_message_id INTEGER NOT NULL,
      assistant_message_id INTEGER,
      tool_call_id TEXT,
      tool_name TEXT NOT NULL,
      arguments_json TEXT NOT NULL,
      status TEXT NOT NULL,
      result_json TEXT,
      error_message TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (request_message_id) REFERENCES agent_messages(id) ON DELETE CASCADE,
      FOREIGN KEY (assistant_message_id) REFERENCES agent_messages(id) ON DELETE SET NULL
    );
    CREATE TABLE track_analysis_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      result_json TEXT,
      error_message TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      notification_read_at TEXT,
      resolved_at TEXT
    );
  `);

  db.prepare(`
    INSERT INTO track_results (
      id, title, artists, album, title_key, artists_key, bpm, genre, sub_genre, track_key,
      summary, status, providers_used_json, errors_json, response_json, raw_response,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    11,
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
    "[]",
    "[]",
    "{}",
    "{}",
    "2026-05-18T10:00:00.000Z",
    "2026-05-18T10:10:00.000Z",
  );

  db.prepare(`
    INSERT INTO remix_results (
      id, provider, link, title, artists, remix_artist, album, genre, sub_genre, bpm,
      uploaded_at, duration_ms, confidence, relevance_reason, original_track_json,
      requested_genre, candidate_json, saved_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    13,
    "SoundCloud",
    "https://soundcloud.com/test/strobe-bass-flip",
    "Strobe (Bass Flip)",
    "DJ Test",
    "DJ Test",
    null,
    "Bass",
    "dubstep",
    null,
    "2026-05-18T10:11:00.000Z",
    180000,
    91,
    "explicit bass remix naming",
    JSON.stringify({ title: "Strobe", artists: "deadmau5", spotifyUrl: null }),
    "bass",
    JSON.stringify({ title: "Strobe (Bass Flip)", provider: "SoundCloud" }),
    "2026-05-18T10:12:00.000Z",
    "2026-05-18T10:13:00.000Z",
  );

  db.prepare(`
    INSERT INTO agent_sessions (id, title, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    21,
    "Strobe by deadmau5",
    JSON.stringify({
      currentFocusTrack: {
        title: "Strobe",
        artists: "deadmau5",
        spotifyUrl: null,
        genre: "bass",
      },
    }),
    "2026-05-18T10:14:00.000Z",
    "2026-05-18T10:15:00.000Z",
  );

  db.prepare(`
    INSERT INTO agent_messages (id, session_id, role, content, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    22,
    21,
    "user",
    "Analyze Strobe by deadmau5",
    "{}",
    "2026-05-18T10:16:00.000Z",
  );

  db.prepare(`
    INSERT INTO agent_messages (id, session_id, role, content, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    23,
    21,
    "assistant",
    "Queued track analysis job #31.",
    JSON.stringify({
      queuedTrackAnalysisJob: {
        id: 31,
        status: "queued",
        operation: "enrich",
      },
    }),
    "2026-05-18T10:17:00.000Z",
  );

  db.prepare(`
    INSERT INTO agent_tool_calls (
      id, session_id, request_message_id, assistant_message_id, tool_call_id,
      tool_name, arguments_json, status, result_json, error_message, started_at,
      completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    24,
    21,
    22,
    23,
    null,
    "analyze_track",
    JSON.stringify({ title: "Strobe", artists: "deadmau5", operation: "analyze" }),
    "completed",
    JSON.stringify({ job: { id: 31, status: "queued", operation: "analyze" } }),
    null,
    "2026-05-18T10:16:30.000Z",
    "2026-05-18T10:16:31.000Z",
  );

  db.prepare(`
    INSERT INTO track_analysis_jobs (
      id, operation, status, payload_json, result_json, error_message, attempt_count,
      max_attempts, created_at, updated_at, completed_at, notification_read_at, resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    31,
    "enrich",
    "completed",
    JSON.stringify({
      operation: "enrich",
      track: { title: "Strobe", artists: "deadmau5" },
      source: "manual",
    }),
    JSON.stringify({ trackName: "Strobe", artist: "deadmau5" }),
    null,
    1,
    3,
    "2026-05-18T10:18:00.000Z",
    "2026-05-18T10:19:00.000Z",
    "2026-05-18T10:19:30.000Z",
    null,
    null,
  );

  db.close();
}

function createCallLog() {
  const calls = {
    trackResult: [] as Array<Record<string, unknown>>,
    remixResult: [] as Array<Record<string, unknown>>,
    agentSession: [] as Array<Record<string, unknown>>,
    agentMessage: [] as Array<Record<string, unknown>>,
    agentToolCall: [] as Array<Record<string, unknown>>,
    trackAnalysisJob: [] as Array<Record<string, unknown>>,
  };

  return {
    client: {
      trackResult: {
        upsert: async (args: Record<string, unknown>) => {
          calls.trackResult.push(args);
          return null;
        },
      },
      remixResult: {
        upsert: async (args: Record<string, unknown>) => {
          calls.remixResult.push(args);
          return null;
        },
      },
      agentSession: {
        upsert: async (args: Record<string, unknown>) => {
          calls.agentSession.push(args);
          return null;
        },
      },
      agentMessage: {
        upsert: async (args: Record<string, unknown>) => {
          calls.agentMessage.push(args);
          return null;
        },
      },
      agentToolCall: {
        upsert: async (args: Record<string, unknown>) => {
          calls.agentToolCall.push(args);
          return null;
        },
      },
      trackAnalysisJob: {
        upsert: async (args: Record<string, unknown>) => {
          calls.trackAnalysisJob.push(args);
          return null;
        },
      },
      $executeRawUnsafe: async () => null,
    },
    ...calls,
  };
}
