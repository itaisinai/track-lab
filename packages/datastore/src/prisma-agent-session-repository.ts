import type {
  AgentMessage,
  AgentMessageMetadata,
  AgentMessageRole,
  AgentSession,
  AgentSessionMetadata,
  AgentToolCall,
  AgentToolCallStatus,
  AgentToolInput,
  AgentToolName,
  TrackAnalysisJob,
} from "@track-lab/api-types";
import { parseJson } from "./lib/json.ts";
import type { AgentSessionRepository } from "./agent-session-repository.ts";
import { createPrismaDatastoreClient, type PrismaDatastoreClient } from "./prisma-datastore-client.ts";
import type { TrackAnalysisJob as TrackAnalysisJobRowType } from "./types.ts";

type PrismaAgentSessionRow = {
  id: number;
  title: string;
  metadataJson: string;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaAgentMessageRow = {
  id: number;
  sessionId: number;
  role: string;
  content: string;
  metadataJson: string;
  createdAt: Date;
};

type PrismaAgentToolCallRow = {
  id: number;
  sessionId: number;
  requestMessageId: number;
  assistantMessageId: number | null;
  toolCallId: string | null;
  toolName: string;
  argumentsJson: string;
  status: string;
  resultJson: string | null;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
};

type PrismaAgentSessionDelegate = {
  create(args: {
    data: Record<string, unknown>;
  }): Promise<PrismaAgentSessionRow>;
  findMany(args: {
    orderBy: Array<Record<string, unknown>>;
  }): Promise<PrismaAgentSessionRow[]>;
  findUnique(args: {
    where: { id: number };
  }): Promise<PrismaAgentSessionRow | null>;
  delete(args: { where: { id: number } }): Promise<unknown>;
  update(args: {
    where: { id: number };
    data: Record<string, unknown>;
  }): Promise<PrismaAgentSessionRow>;
};

type PrismaAgentMessageDelegate = {
  create(args: {
    data: Record<string, unknown>;
  }): Promise<PrismaAgentMessageRow>;
  findMany(args: {
    where?: Record<string, unknown>;
    orderBy: Array<Record<string, unknown>>;
  }): Promise<PrismaAgentMessageRow[]>;
  findUnique(args: {
    where: { id: number };
  }): Promise<PrismaAgentMessageRow | null>;
  update(args: {
    where: { id: number };
    data: Record<string, unknown>;
  }): Promise<PrismaAgentMessageRow>;
};

type PrismaAgentToolCallDelegate = {
  create(args: {
    data: Record<string, unknown>;
  }): Promise<PrismaAgentToolCallRow>;
  findMany(args: {
    where?: Record<string, unknown>;
    orderBy: Array<Record<string, unknown>>;
  }): Promise<PrismaAgentToolCallRow[]>;
  findUnique(args: {
    where: { id: number };
  }): Promise<PrismaAgentToolCallRow | null>;
  update(args: {
    where: { id: number };
    data: Record<string, unknown>;
  }): Promise<PrismaAgentToolCallRow>;
};

export type PrismaAgentSessionClient = PrismaDatastoreClient & {
  agentSession: PrismaAgentSessionDelegate;
  agentMessage: PrismaAgentMessageDelegate;
  agentToolCall: PrismaAgentToolCallDelegate;
};

export type PrismaAgentSessionRepositoryOptions = {
  client?: PrismaAgentSessionClient;
};

export class PrismaAgentSessionRepository implements AgentSessionRepository {
  private readonly client: PrismaAgentSessionClient;

  constructor(options: PrismaAgentSessionRepositoryOptions = {}) {
    this.client = options.client ?? (createPrismaDatastoreClient() as PrismaAgentSessionClient);
  }

  async createSession(title = "New chat"): Promise<AgentSession> {
    const now = new Date();
    const row = await this.client.agentSession.create({
      data: {
        title,
        metadataJson: "{}",
        createdAt: now,
        updatedAt: now,
      },
    });

    return mapSessionRow(row);
  }

  async listSessions(): Promise<AgentSession[]> {
    const rows = await this.client.agentSession.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });

    return rows.map(mapSessionRow);
  }

  async getSession(id: number): Promise<AgentSession | null> {
    const row = await this.client.agentSession.findUnique({ where: { id } });
    return row ? mapSessionRow(row) : null;
  }

  async deleteSession(id: number): Promise<boolean> {
    const row = await this.client.agentSession.findUnique({ where: { id } });

    if (!row) {
      return false;
    }

    await this.client.agentSession.delete({ where: { id } });
    return true;
  }

  async updateSessionTitle(id: number, title: string): Promise<AgentSession> {
    const nextTitle = title.trim();
    if (!nextTitle) {
      throw new Error("Agent session title is required.");
    }

    const row = await this.client.agentSession.update({
      where: { id },
      data: {
        title: nextTitle,
        updatedAt: new Date(),
      },
    });

    return mapSessionRow(row);
  }

  async updateSessionMetadata(
    sessionId: number,
    metadata:
      | AgentSessionMetadata
      | ((current: AgentSessionMetadata) => AgentSessionMetadata),
  ): Promise<AgentSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error("Agent session was not found.");
    }

    const nextMetadata =
      typeof metadata === "function" ? metadata(session.metadata) : metadata;
    const row = await this.client.agentSession.update({
      where: { id: sessionId },
      data: {
        metadataJson: JSON.stringify(nextMetadata),
        updatedAt: new Date(),
      },
    });

    return mapSessionRow(row);
  }

  async syncCompletedAnalysisJob(job: TrackAnalysisJob): Promise<void> {
    if (
      job.status !== "completed" ||
      (job.operation !== "analyze" && job.operation !== "enrich")
    ) {
      return;
    }

    const track = getTrackReferenceFromJob(job);
    if (!track) {
      return;
    }

    const sessionIds = await this.findSessionIdsForQueuedJob(job.id);
    for (const sessionId of sessionIds) {
      await this.updateSessionTitle(sessionId, `${track.title} by ${track.artists}`);
      await this.updateSessionMetadata(sessionId, (current) => ({
        ...current,
        currentFocusTrack: {
          ...current.currentFocusTrack,
          title: track.title,
          artists: track.artists,
        },
        latestAnalyzedTrack: {
          ...current.latestAnalyzedTrack,
          title: track.title,
          artists: track.artists,
        },
        latestAnalysisResult: job.result,
      }));
    }
  }

  async listMessages(sessionId: number): Promise<AgentMessage[]> {
    const rows = await this.client.agentMessage.findMany({
      where: { sessionId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return rows.map(mapMessageRow);
  }

  async listToolCalls(sessionId: number): Promise<AgentToolCall[]> {
    const rows = await this.client.agentToolCall.findMany({
      where: { sessionId },
      orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    });

    return rows.map(mapToolCallRow);
  }

  async addMessage(input: {
    sessionId: number;
    role: AgentMessageRole;
    content: string;
    metadata?: AgentMessageMetadata;
  }): Promise<AgentMessage> {
    const row = await this.client.agentMessage.create({
      data: {
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        metadataJson: JSON.stringify(input.metadata ?? {}),
        createdAt: new Date(),
      },
    });

    await this.touchSession(input.sessionId);
    return mapMessageRow(row);
  }

  async startToolCall(input: {
    sessionId: number;
    requestMessageId: number;
    toolCallId?: string | null;
    toolName: AgentToolName;
    arguments: AgentToolInput;
  }): Promise<AgentToolCall> {
    const row = await this.client.agentToolCall.create({
      data: {
        sessionId: input.sessionId,
        requestMessageId: input.requestMessageId,
        assistantMessageId: null,
        toolCallId: input.toolCallId ?? null,
        toolName: input.toolName,
        argumentsJson: JSON.stringify(input.arguments),
        status: "running",
        resultJson: null,
        errorMessage: null,
        startedAt: new Date(),
        completedAt: null,
      },
    });

    await this.touchSession(input.sessionId);
    return mapToolCallRow(row);
  }

  async completeToolCall(id: number, result: unknown): Promise<AgentToolCall | null> {
    return this.finishToolCall(id, "completed", result, null);
  }

  async failToolCall(id: number, errorMessage: string): Promise<AgentToolCall | null> {
    return this.finishToolCall(id, "failed", null, errorMessage);
  }

  async attachToolCallsToAssistantMessage(
    toolCallIds: number[],
    assistantMessageId: number,
  ): Promise<void> {
    if (!toolCallIds.length) {
      return;
    }

    for (const id of toolCallIds) {
      await this.client.agentToolCall.update({
        where: { id },
        data: {
          assistantMessageId,
        },
      });
    }

    const first = await this.getToolCall(toolCallIds[0]);
    if (first) {
      await this.touchSession(first.sessionId);
    }
  }

  private async getToolCall(id: number): Promise<AgentToolCall | null> {
    const row = await this.client.agentToolCall.findUnique({ where: { id } });
    return row ? mapToolCallRow(row) : null;
  }

  private async finishToolCall(
    id: number,
    status: AgentToolCallStatus,
    result: unknown | null,
    errorMessage: string | null,
  ) {
    const row = await this.client.agentToolCall.update({
      where: { id },
      data: {
        status,
        resultJson: result === null ? null : JSON.stringify(result),
        errorMessage,
        completedAt: new Date(),
      },
    });

    const toolCall = mapToolCallRow(row);
    await this.touchSession(toolCall.sessionId);
    return toolCall;
  }

  private async touchSession(id: number) {
    await this.client.agentSession.update({
      where: { id },
      data: {
        updatedAt: new Date(),
      },
    });
  }

  private async findSessionIdsForQueuedJob(jobId: number) {
    const rows = await this.client.agentMessage.findMany({
      where: {
        metadataJson: {
          contains: "queuedTrackAnalysisJob",
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    const sessionIds = new Set<number>();
    for (const row of rows) {
      const metadata = parseJson(row.metadataJson) as {
        queuedTrackAnalysisJob?: { id?: unknown };
      };

      if (metadata.queuedTrackAnalysisJob?.id === jobId) {
        sessionIds.add(row.sessionId);
      }
    }

    return Array.from(sessionIds);
  }
}

function mapSessionRow(row: PrismaAgentSessionRow): AgentSession {
  return {
    id: row.id,
    title: row.title,
    metadata: parseJson(row.metadataJson) as AgentSessionMetadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapMessageRow(row: PrismaAgentMessageRow): AgentMessage {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role as AgentMessageRole,
    content: row.content,
    metadata: parseJson(row.metadataJson) as AgentMessageMetadata,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapToolCallRow(row: PrismaAgentToolCallRow): AgentToolCall {
  return {
    id: row.id,
    sessionId: row.sessionId,
    requestMessageId: row.requestMessageId,
    assistantMessageId: row.assistantMessageId,
    toolCallId: row.toolCallId,
    toolName: row.toolName as AgentToolName,
    arguments: parseJson(row.argumentsJson) as AgentToolInput,
    status: row.status as AgentToolCallStatus,
    result: row.resultJson ? parseJson(row.resultJson) : null,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

function getTrackReferenceFromJob(job: TrackAnalysisJob) {
  if (job.payload.operation === "remix_search") {
    return null;
  }

  const resultTrack = getTrackReferenceFromResult(job.result);
  if (resultTrack) {
    return resultTrack;
  }

  return {
    title: job.payload.track.title,
    artists: job.payload.track.artists,
  };
}

function getTrackReferenceFromResult(result: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return null;
  }

  const record = result as {
    title?: unknown;
    artists?: unknown;
    trackName?: unknown;
    artist?: unknown;
  };
  const title = getNonEmptyString(record.title) ?? getNonEmptyString(record.trackName);
  const artists = getNonEmptyString(record.artists) ?? getNonEmptyString(record.artist);

  return title && artists ? { title, artists } : null;
}

function getNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
