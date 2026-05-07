import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { RemixSearchCandidate } from "@track-lab/api-types";
import { getDefaultDatabasePath } from "./db-path.ts";
import { parseJson } from "./lib/json.ts";
import type {
  SavedRemix,
  SavedRemixRow,
  SaveRemixCandidateRequest,
} from "./types.ts";

export class RemixResultStore {
  readonly db: DatabaseSync;

  constructor(databasePath = getDefaultDatabasePath()) {
    const resolvedPath = resolve(databasePath);
    mkdirSync(dirname(resolvedPath), { recursive: true });
    this.db = new DatabaseSync(resolvedPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS remix_results (
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
        saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(provider, link)
      )
    `);
  }

  listRemixes(): SavedRemix[] {
    const rows = this.db
      .prepare("SELECT * FROM remix_results ORDER BY updated_at DESC, id DESC")
      .all() as SavedRemixRow[];

    return rows.map(mapRowToSavedRemix);
  }

  saveRemix(input: SaveRemixCandidateRequest): SavedRemix {
    const now = new Date().toISOString();
    const { candidate } = input;

    this.db
      .prepare(`
        INSERT INTO remix_results (
          provider,
          link,
          title,
          artists,
          remix_artist,
          album,
          genre,
          sub_genre,
          bpm,
          uploaded_at,
          duration_ms,
          confidence,
          relevance_reason,
          original_track_json,
          requested_genre,
          candidate_json,
          saved_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider, link) DO UPDATE SET
          title = excluded.title,
          artists = excluded.artists,
          remix_artist = excluded.remix_artist,
          album = excluded.album,
          genre = excluded.genre,
          sub_genre = excluded.sub_genre,
          bpm = excluded.bpm,
          uploaded_at = excluded.uploaded_at,
          duration_ms = excluded.duration_ms,
          confidence = excluded.confidence,
          relevance_reason = excluded.relevance_reason,
          original_track_json = excluded.original_track_json,
          requested_genre = excluded.requested_genre,
          candidate_json = excluded.candidate_json,
          updated_at = excluded.updated_at
      `)
      .run(
        candidate.provider,
        candidate.link,
        candidate.title,
        candidate.artists,
        candidate.remixArtist ?? null,
        candidate.album ?? null,
        candidate.genre ?? null,
        candidate.subGenre ?? null,
        candidate.bpm ?? null,
        candidate.createdAt ?? null,
        candidate.durationMs ?? null,
        candidate.confidence,
        candidate.relevanceReason,
        JSON.stringify(input.originalTrack),
        input.requestedGenre ?? null,
        JSON.stringify(candidate),
        now,
        now,
      );

    const saved = this.db
      .prepare("SELECT * FROM remix_results WHERE provider = ? AND link = ?")
      .get(candidate.provider, candidate.link) as SavedRemixRow | undefined;

    if (!saved) {
      throw new Error("Remix was not saved.");
    }

    return mapRowToSavedRemix(saved);
  }
}

function mapRowToSavedRemix(row: SavedRemixRow): SavedRemix {
  const candidate = parseJson(row.candidate_json) as RemixSearchCandidate;

  return {
    ...candidate,
    id: row.id,
    title: row.title,
    artists: row.artists,
    remixArtist: row.remix_artist,
    album: row.album,
    genre: row.genre,
    subGenre: row.sub_genre,
    bpm: row.bpm,
    provider: row.provider as RemixSearchCandidate["provider"],
    link: row.link,
    createdAt: row.uploaded_at,
    durationMs: row.duration_ms,
    confidence: row.confidence,
    relevanceReason: row.relevance_reason,
    originalTrack: parseJson(row.original_track_json) as SavedRemix["originalTrack"],
    requestedGenre: row.requested_genre,
    savedAt: row.saved_at,
    updatedAt: row.updated_at,
  };
}
