import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { TrackResultStore } from "../track-result-store.ts";

test("saved result status is complete when final metadata has bpm and genre", () => {
  const databasePath = join(mkdtempSync(join(tmpdir(), "track-lab-")), "db.sqlite");
  const store = new TrackResultStore(databasePath);

  const result = store.saveResult({
    rawResponse: "{}",
    json: {
      trackName: "Money Bag",
      artist: "Cardi B",
      album: "Money",
      bpm: 129,
      genre: "hip hop",
      subGenre: "trap",
      key: "A#m",
      status: "partial",
      providersUsed: [
        { name: "Spotify", matched: true, url: "https://open.spotify.com/track/1" },
      ],
    },
  });

  assert.equal(result.status, "complete");
});

test("track result store migrates legacy tool status column to provider status", () => {
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
      tools_used_json TEXT NOT NULL,
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
      tools_used_json,
      errors_json,
      response_json,
      raw_response,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "Strobe",
    "deadmau5",
    "For Lack of a Better Name",
    "strobe",
    "deadmau5",
    128,
    "Progressive House",
    null,
    null,
    null,
    "complete",
    JSON.stringify([{ name: "Spotify", matched: true, url: null, error: null }]),
    "[]",
    "{}",
    "{}",
    new Date().toISOString(),
    new Date().toISOString(),
  );
  db.close();

  const store = new TrackResultStore(databasePath);
  const [result] = store.listResults();

  assert.deepEqual(result?.providersUsed, [
    { name: "Spotify", matched: true, url: null, error: null },
  ]);
});

test("track result store saves new rows when legacy tools_used_json column remains", () => {
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
      tools_used_json TEXT NOT NULL,
      errors_json TEXT NOT NULL,
      response_json TEXT NOT NULL,
      raw_response TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(title_key, artists_key)
    )
  `);
  db.close();

  const store = new TrackResultStore(databasePath);
  const result = store.saveResult({
    rawResponse: "{}",
    json: {
      trackName: "Let It Happen",
      artist: "Tame Impala",
      bpm: 125,
      genre: "neo-psychedelia",
      providersUsed: [
        { name: "Spotify", matched: true, url: "https://open.spotify.com/track/2X485T9Z5Ly0xyaghN73ed" },
      ],
      status: "complete",
    },
  });

  assert.equal(result.title, "Let It Happen");
  assert.deepEqual(result.providersUsed, [
    {
      name: "Spotify",
      matched: true,
      url: "https://open.spotify.com/track/2X485T9Z5Ly0xyaghN73ed",
      error: null,
    },
  ]);
});
