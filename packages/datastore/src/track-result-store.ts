import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getDefaultDatabasePath } from "./db-path.ts";
import { parseJson, parseJsonArray } from "./lib/json.ts";
import { normalizeUniqueKey } from "./lib/object.ts";
import { normalizeTrackResult } from "./normalization.ts";
import type {
  ResultError,
  SaveTrackResultInput,
  ToolStatus,
  TrackResult,
  TrackResultRow,
} from "./types.ts";

export class TrackResultStore {
  readonly db: DatabaseSync;

  constructor(databasePath = getDefaultDatabasePath()) {
    const resolvedPath = resolve(databasePath);
    mkdirSync(dirname(resolvedPath), { recursive: true });
    this.db = new DatabaseSync(resolvedPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS track_results (
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
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(title_key, artists_key)
      )
    `);
    this.migrate();
  }

  listResults(): TrackResult[] {
    const rows = this.db
      .prepare("SELECT * FROM track_results ORDER BY updated_at DESC, id DESC")
      .all() as TrackResultRow[];

    return rows.map(mapRowToTrackResult);
  }

  getResult(id: number): TrackResult | null {
    const row = this.db
      .prepare("SELECT * FROM track_results WHERE id = ?")
      .get(id) as TrackResultRow | undefined;

    return row ? mapRowToTrackResult(row) : null;
  }

  findByTrack(title: string, artists: string): TrackResult | null {
    const row = this.db
      .prepare(
        "SELECT * FROM track_results WHERE title_key = ? AND artists_key = ?",
      )
      .get(normalizeUniqueKey(title), normalizeUniqueKey(artists)) as
      | TrackResultRow
      | undefined;

    return row ? mapRowToTrackResult(row) : null;
  }

  deleteResult(id: number): boolean {
    const result = this.db
      .prepare("DELETE FROM track_results WHERE id = ?")
      .run(id);

    return result.changes > 0;
  }

  saveResult(input: SaveTrackResultInput): TrackResult {
    const normalized = normalizeTrackResult(input);
    const now = new Date().toISOString();

    this.db
      .prepare(`
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
        ON CONFLICT(title_key, artists_key) DO UPDATE SET
          title = excluded.title,
          artists = excluded.artists,
          album = excluded.album,
          bpm = excluded.bpm,
          genre = excluded.genre,
          sub_genre = excluded.sub_genre,
          track_key = excluded.track_key,
          summary = excluded.summary,
          status = excluded.status,
          tools_used_json = excluded.tools_used_json,
          errors_json = excluded.errors_json,
          response_json = excluded.response_json,
          raw_response = excluded.raw_response,
          updated_at = excluded.updated_at
      `)
      .run(
        normalized.title,
        normalized.artists,
        normalized.album,
        normalizeUniqueKey(normalized.title),
        normalizeUniqueKey(normalized.artists),
        normalized.bpm,
        normalized.genre,
        normalized.subGenre,
        normalized.key,
        normalized.summary,
        normalized.status,
        JSON.stringify(normalized.toolsUsed),
        JSON.stringify(normalized.errors),
        JSON.stringify(input.json),
        input.rawResponse,
        now,
        now,
      );

    const saved = this.db
      .prepare(
        "SELECT * FROM track_results WHERE title_key = ? AND artists_key = ?",
      )
      .get(
        normalizeUniqueKey(normalized.title),
        normalizeUniqueKey(normalized.artists),
      ) as TrackResultRow | undefined;

    if (!saved) {
      throw new Error("Result was not saved.");
    }

    return mapRowToTrackResult(saved);
  }

  private migrate() {
    const columns = this.db
      .prepare("PRAGMA table_info(track_results)")
      .all() as Array<{ name: string }>;
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has("album")) {
      this.db.exec("ALTER TABLE track_results ADD COLUMN album TEXT");
    }
  }
}

function mapRowToTrackResult(row: TrackResultRow): TrackResult {
  return {
    id: row.id,
    title: row.title,
    artists: row.artists,
    album: row.album,
    bpm: row.bpm,
    genre: row.genre,
    subGenre: row.sub_genre,
    key: row.track_key,
    summary: row.summary,
    status: row.status,
    toolsUsed: parseJsonArray<ToolStatus>(row.tools_used_json),
    errors: parseJsonArray<ResultError>(row.errors_json),
    json: parseJson(row.response_json),
    rawResponse: row.raw_response,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
