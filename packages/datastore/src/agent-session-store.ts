import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getDefaultDatabasePath } from "./db-path.ts";
import { parseJson } from "./lib/json.ts";
import type {
  AgentMessage,
  AgentMessageMetadata,
  AgentMessageRole,
  AgentMessageRow,
  AgentSession,
  AgentSessionMetadata,
  AgentSessionRow,
  AgentToolCall,
  AgentToolCallRow,
  AgentToolCallStatus,
  AgentToolInput,
  AgentToolName,
} from "./types.ts";

export class AgentSessionStore {
  readonly db: DatabaseSync;

  constructor(databasePath = getDefaultDatabasePath()) {
    const resolvedPath = resolve(databasePath);
    mkdirSync(dirname(resolvedPath), { recursive: true });
    this.db = new DatabaseSync(resolvedPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.createTables();
  }

  createSession(title = "New chat"): AgentSession {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(`
        INSERT INTO agent_sessions (title, created_at, updated_at)
        VALUES (?, ?, ?)
      `)
      .run(title, now, now);

    return this.getSession(Number(result.lastInsertRowid)) as AgentSession;
  }

  listSessions(): AgentSession[] {
    const rows = this.db
      .prepare("SELECT * FROM agent_sessions ORDER BY updated_at DESC, id DESC")
      .all() as AgentSessionRow[];

    return rows.map(mapSessionRow);
  }

  getSession(id: number): AgentSession | null {
    const row = this.db
      .prepare("SELECT * FROM agent_sessions WHERE id = ?")
      .get(id) as AgentSessionRow | undefined;

    return row ? mapSessionRow(row) : null;
  }

  deleteSession(id: number): boolean {
    const result = this.db
      .prepare("DELETE FROM agent_sessions WHERE id = ?")
      .run(id);

    return result.changes > 0;
  }

  listMessages(sessionId: number): AgentMessage[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM agent_messages
        WHERE session_id = ?
        ORDER BY created_at ASC, id ASC
      `)
      .all(sessionId) as AgentMessageRow[];

    return rows.map(mapMessageRow);
  }

  listToolCalls(sessionId: number): AgentToolCall[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM agent_tool_calls
        WHERE session_id = ?
        ORDER BY started_at ASC, id ASC
      `)
      .all(sessionId) as AgentToolCallRow[];

    return rows.map(mapToolCallRow);
  }

  updateSessionMetadata(
    sessionId: number,
    metadata:
      | AgentSessionMetadata
      | ((current: AgentSessionMetadata) => AgentSessionMetadata),
  ): AgentSession {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error("Agent session was not found.");
    }

    const nextMetadata =
      typeof metadata === "function" ? metadata(session.metadata) : metadata;
    const now = new Date().toISOString();
    this.db
      .prepare(`
        UPDATE agent_sessions
        SET metadata_json = ?,
            updated_at = ?
        WHERE id = ?
      `)
      .run(JSON.stringify(nextMetadata), now, sessionId);

    return this.getSession(sessionId) as AgentSession;
  }

  addMessage(input: {
    sessionId: number;
    role: AgentMessageRole;
    content: string;
    metadata?: AgentMessageMetadata;
  }): AgentMessage {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(`
        INSERT INTO agent_messages (
          session_id,
          role,
          content,
          metadata_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        input.sessionId,
        input.role,
        input.content,
        JSON.stringify(input.metadata ?? {}),
        now,
      );

    this.touchSession(input.sessionId, now);
    return this.getMessage(Number(result.lastInsertRowid)) as AgentMessage;
  }

  startToolCall(input: {
    sessionId: number;
    requestMessageId: number;
    toolCallId?: string | null;
    toolName: AgentToolName;
    arguments: AgentToolInput;
  }): AgentToolCall {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(`
        INSERT INTO agent_tool_calls (
          session_id,
          request_message_id,
          assistant_message_id,
          tool_call_id,
          tool_name,
          arguments_json,
          status,
          result_json,
          error_message,
          started_at,
          completed_at
        ) VALUES (?, ?, NULL, ?, ?, ?, 'running', NULL, NULL, ?, NULL)
      `)
      .run(
        input.sessionId,
        input.requestMessageId,
        input.toolCallId ?? null,
        input.toolName,
        JSON.stringify(input.arguments),
        now,
      );

    this.touchSession(input.sessionId, now);
    return this.getToolCall(Number(result.lastInsertRowid)) as AgentToolCall;
  }

  completeToolCall(id: number, result: unknown): AgentToolCall | null {
    return this.finishToolCall(id, "completed", result, null);
  }

  failToolCall(id: number, errorMessage: string): AgentToolCall | null {
    return this.finishToolCall(id, "failed", null, errorMessage);
  }

  attachToolCallsToAssistantMessage(
    toolCallIds: number[],
    assistantMessageId: number,
  ) {
    if (!toolCallIds.length) {
      return;
    }

    const now = new Date().toISOString();
    const statement = this.db.prepare(`
      UPDATE agent_tool_calls
      SET assistant_message_id = ?
      WHERE id = ?
    `);

    for (const id of toolCallIds) {
      statement.run(assistantMessageId, id);
    }

    const first = this.getToolCall(toolCallIds[0]);
    if (first) {
      this.touchSession(first.sessionId, now);
    }
  }

  private getMessage(id: number): AgentMessage | null {
    const row = this.db
      .prepare("SELECT * FROM agent_messages WHERE id = ?")
      .get(id) as AgentMessageRow | undefined;

    return row ? mapMessageRow(row) : null;
  }

  private getToolCall(id: number): AgentToolCall | null {
    const row = this.db
      .prepare("SELECT * FROM agent_tool_calls WHERE id = ?")
      .get(id) as AgentToolCallRow | undefined;

    return row ? mapToolCallRow(row) : null;
  }

  private finishToolCall(
    id: number,
    status: AgentToolCallStatus,
    result: unknown | null,
    errorMessage: string | null,
  ) {
    const now = new Date().toISOString();
    this.db
      .prepare(`
        UPDATE agent_tool_calls
        SET status = ?,
            result_json = ?,
            error_message = ?,
            completed_at = ?
        WHERE id = ?
      `)
      .run(
        status,
        result === null ? null : JSON.stringify(result),
        errorMessage,
        now,
        id,
      );

    const toolCall = this.getToolCall(id);
    if (toolCall) {
      this.touchSession(toolCall.sessionId, now);
    }
    return toolCall;
  }

  private touchSession(id: number, updatedAt: string) {
    this.db
      .prepare("UPDATE agent_sessions SET updated_at = ? WHERE id = ?")
      .run(updatedAt, id);
  }

  private createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    this.addColumnIfMissing("agent_sessions", "metadata_json", "TEXT NOT NULL DEFAULT '{}'");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
      )
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_tool_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        request_message_id INTEGER NOT NULL,
        assistant_message_id INTEGER,
        tool_call_id TEXT,
        tool_name TEXT NOT NULL CHECK (tool_name IN ('analyze_track', 'search_remixes')),
        arguments_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
        result_json TEXT,
        error_message TEXT,
        started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (request_message_id) REFERENCES agent_messages(id) ON DELETE CASCADE,
        FOREIGN KEY (assistant_message_id) REFERENCES agent_messages(id) ON DELETE SET NULL
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_messages_session_created
      ON agent_messages(session_id, created_at, id)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_session_started
      ON agent_tool_calls(session_id, started_at, id)
    `);
  }

  private addColumnIfMissing(tableName: string, columnName: string, definition: string) {
    const rows = this.db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all() as Array<{ name: string }>;

    if (rows.some((row) => row.name === columnName)) {
      return;
    }

    this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function mapSessionRow(row: AgentSessionRow): AgentSession {
  return {
    id: row.id,
    title: row.title,
    metadata: parseJson(row.metadata_json) as AgentSessionMetadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessageRow(row: AgentMessageRow): AgentMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    metadata: parseJson(row.metadata_json) as AgentMessageMetadata,
    createdAt: row.created_at,
  };
}

function mapToolCallRow(row: AgentToolCallRow): AgentToolCall {
  return {
    id: row.id,
    sessionId: row.session_id,
    requestMessageId: row.request_message_id,
    assistantMessageId: row.assistant_message_id,
    toolCallId: row.tool_call_id,
    toolName: row.tool_name,
    arguments: parseJson(row.arguments_json) as AgentToolInput,
    status: row.status,
    result: row.result_json ? parseJson(row.result_json) : null,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}
