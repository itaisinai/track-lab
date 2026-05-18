import assert from "node:assert/strict";
import test from "node:test";
import {
  PrismaAgentSessionRepository,
  PrismaTrackAnalysisJobRepository,
} from "@track-lab/datastore";
import { TrackAnalysisOrchestrator } from "@track-lab/track-analysis";
import { AgentToolExecutor } from "../tools/tool-executor.ts";

test("agent tool executor applies interpreted genre to contextual remix searches", async () => {
  const store = createStore();
  const jobStore = createJobStore();
  const queue = createDatabaseQueue();
  const session = await store.createSession();
  await store.updateSessionMetadata(session.id, {
    currentFocusTrack: {
      title: "strobe",
      artists: "deadmau5",
      spotifyUrl: null,
      genre: null,
    },
  });
  const requestMessage = await store.addMessage({
    sessionId: session.id,
    role: "user",
    content: "find me bass remixes",
  });
  const executor = new AgentToolExecutor(
    store,
    new TrackAnalysisOrchestrator(jobStore, queue),
  );

  const execution = await executor.executeTool({
    sessionId: session.id,
    requestMessageId: requestMessage.id,
    toolName: "search_remixes",
    arguments: {
      title: null,
      artists: null,
      spotifyUrl: null,
      genre: null,
    },
    requestContext: {
      requestedGenre: "bass",
      usesCurrentFocus: true,
      tool: "search_remixes",
    },
  });

  assert.equal(execution.call.status, "completed");
  assert.deepEqual(execution.call.arguments, {
    title: "strobe",
    artists: "deadmau5",
    spotifyUrl: null,
    genre: "bass",
  });
  assert.deepEqual(
    (await jobStore.listJobs({ statuses: ["queued"] }))[0]?.payload,
    {
      operation: "remix_search",
      request: {
        title: "strobe",
        artists: "deadmau5",
        spotifyUrl: null,
        genre: "bass",
      },
    },
  );
});

function createJobStore() {
  return new PrismaTrackAnalysisJobRepository({
    client: createJobClient() as never,
  });
}

function createStore() {
  return new PrismaAgentSessionRepository({
    client: createAgentClient() as never,
  });
}

function createJobClient() {
  const state: Array<Record<string, unknown>> = [];
  let nextId = 1;

  return {
    trackAnalysisJob: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: nextId++,
          ...data,
        };
        state.push(row);
        return row as never;
      },
      findMany: async ({ where }: { where?: Record<string, unknown> }) => {
        let rows = [...state];
        if (where?.status && typeof where.status === "object") {
          const statuses = (where.status as { in?: string[] }).in;
          if (statuses) {
            rows = rows.filter((row) => statuses.includes(String(row.status)));
          }
        }
        return rows as never;
      },
      findUnique: async ({ where }: { where: { id: number } }) =>
        (state.find((row) => row.id === where.id) ?? null) as never,
      update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
        const row = state.find((entry) => entry.id === where.id);
        if (!row) throw new Error("not found");
        if (data.attemptCount && typeof data.attemptCount === "object") {
          row.attemptCount = Number(row.attemptCount ?? 0) + 1;
        }
        Object.assign(row, {
          ...data,
          attemptCount: row.attemptCount,
        });
        return row as never;
      },
    },
    $transaction: async <T>(callback: (client: any) => Promise<T>) =>
      callback({
        $queryRaw: async () => [],
        trackAnalysisJob: {
          create: async ({ data }: { data: Record<string, unknown> }) =>
            createJobClient().trackAnalysisJob.create({ data }),
        },
      }),
  };
}

function createAgentClient() {
  const state = {
    sessions: [] as Array<Record<string, unknown>>,
    messages: [] as Array<Record<string, unknown>>,
    toolCalls: [] as Array<Record<string, unknown>>,
  };

  let nextSessionId = 1;
  let nextMessageId = 1;
  let nextToolCallId = 1;

  return {
    agentSession: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: nextSessionId++,
          title: data.title,
          metadataJson: (data.metadataJson as string) ?? "{}",
          createdAt: data.createdAt as Date,
          updatedAt: data.updatedAt as Date,
        };
        state.sessions.push(row);
        return row as never;
      },
      findMany: async () => ([...state.sessions] as never),
      findUnique: async ({ where }: { where: { id: number } }) =>
        (state.sessions.find((row) => row.id === where.id) ?? null) as never,
      delete: async ({ where }: { where: { id: number } }) => {
        const index = state.sessions.findIndex((row) => row.id === where.id);
        if (index < 0) throw new Error("not found");
        state.sessions.splice(index, 1);
        state.messages = state.messages.filter((row) => row.sessionId !== where.id);
        state.toolCalls = state.toolCalls.filter((row) => row.sessionId !== where.id);
      },
      update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
        const row = state.sessions.find((entry) => entry.id === where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        return row as never;
      },
    },
    agentMessage: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: nextMessageId++,
          sessionId: data.sessionId,
          role: data.role,
          content: data.content,
          metadataJson: data.metadataJson,
          createdAt: data.createdAt as Date,
        };
        state.messages.push(row);
        return row as never;
      },
      findMany: async ({ where }: { where?: Record<string, unknown> }) => {
        let rows = [...state.messages];
        if (where?.sessionId !== undefined) {
          rows = rows.filter((row) => row.sessionId === where.sessionId);
        }
        return rows as never;
      },
      findUnique: async ({ where }: { where: { id: number } }) =>
        (state.messages.find((row) => row.id === where.id) ?? null) as never,
      update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
        const row = state.messages.find((entry) => entry.id === where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        return row as never;
      },
    },
    agentToolCall: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: nextToolCallId++,
          ...data,
        };
        state.toolCalls.push(row);
        return row as never;
      },
      findMany: async ({ where }: { where?: Record<string, unknown> }) => {
        let rows = [...state.toolCalls];
        if (where?.sessionId !== undefined) {
          rows = rows.filter((row) => row.sessionId === where.sessionId);
        }
        return rows as never;
      },
      findUnique: async ({ where }: { where: { id: number } }) =>
        (state.toolCalls.find((row) => row.id === where.id) ?? null) as never,
      update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
        const row = state.toolCalls.find((entry) => entry.id === where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        return row as never;
      },
    },
  };
}

function createDatabaseQueue() {
  return {
    mode: "database" as const,
    async enqueue() {},
    async receiveNextMessage() {
      return null;
    },
    async deleteMessage() {},
  };
}
