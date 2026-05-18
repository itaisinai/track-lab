import assert from "node:assert/strict";
import test from "node:test";
import { PrismaAgentSessionRepository } from "../prisma-agent-session-repository.ts";

test("prisma agent session repository persists chat state", async () => {
  const repository = new PrismaAgentSessionRepository({
    client: createMemoryClient() as never,
  });

  const session = await repository.createSession("Discovery");
  const userMessage = await repository.addMessage({
    sessionId: session.id,
    role: "user",
    content: "Analyze Strobe by deadmau5",
  });
  const toolCall = await repository.startToolCall({
    sessionId: session.id,
    requestMessageId: userMessage.id,
    toolName: "analyze_track",
    arguments: {
      title: "Strobe",
      artists: "deadmau5",
    },
  });
  await repository.completeToolCall(toolCall.id, { status: "complete" });
  const assistantMessage = await repository.addMessage({
    sessionId: session.id,
    role: "assistant",
    content: "Analysis complete.",
    metadata: {
      toolCallIds: [toolCall.id],
      analysisResult: { status: "complete" },
    },
  });
  await repository.attachToolCallsToAssistantMessage([toolCall.id], assistantMessage.id);

  assert.equal((await repository.listSessions()).length, 1);
  assert.deepEqual(
    (await repository.listMessages(session.id)).map((message) => message.role),
    ["user", "assistant"],
  );

  const calls = await repository.listToolCalls(session.id);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.status, "completed");
  assert.equal(calls[0]?.assistantMessageId, assistantMessage.id);
  assert.deepEqual(calls[0]?.result, { status: "complete" });

  const updated = await repository.updateSessionMetadata(session.id, {
    currentFocusTrack: {
      title: "Strobe",
      artists: "deadmau5",
      spotifyUrl: null,
    },
  });
  assert.equal(updated.metadata.currentFocusTrack?.title, "Strobe");

  assert.equal(await repository.deleteSession(session.id), true);
  assert.equal(await repository.getSession(session.id), null);
  assert.equal((await repository.listMessages(session.id)).length, 0);
  assert.equal((await repository.listToolCalls(session.id)).length, 0);
});

test("prisma agent session repository syncs completed analysis jobs", async () => {
  const repository = new PrismaAgentSessionRepository({
    client: createMemoryClient() as never,
  });

  const session = await repository.createSession("New chat");
  await repository.addMessage({
    sessionId: session.id,
    role: "assistant",
    content: "Queued track analysis job #116.",
    metadata: {
      queuedTrackAnalysisJob: {
        id: 116,
        status: "queued",
        operation: "enrich",
      },
    },
  });

  await repository.syncCompletedAnalysisJob({
    id: 116,
    operation: "enrich",
    status: "completed",
    payload: {
      operation: "enrich",
      track: {
        title: "want it",
        artists: "peekaboo",
      },
      source: "manual",
    },
    result: {
      trackName: "Want It",
      artist: "PEEKABOO",
      bpm: 140,
    },
    errorMessage: null,
    attemptCount: 1,
    maxAttempts: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    notificationReadAt: null,
    resolvedAt: null,
  });

  const updated = await repository.getSession(session.id);
  assert.equal(updated?.title, "Want It by PEEKABOO");
  assert.equal(updated?.metadata.currentFocusTrack?.title, "Want It");
});

function createMemoryClient() {
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
      findMany: async () =>
        ([...state.sessions].sort((left, right) => compareRows(right, left))) as never,
      findUnique: async ({ where }: { where: { id: number } }) =>
        (state.sessions.find((row) => row.id === where.id) ?? null) as never,
      delete: async ({ where }: { where: { id: number } }) => {
        const index = state.sessions.findIndex((row) => row.id === where.id);
        if (index < 0) {
          throw new Error("not found");
        }
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
        if (typeof where?.metadataJson === "object" && where.metadataJson) {
          const contains = (where.metadataJson as { contains?: string }).contains;
          if (contains) {
            rows = rows.filter((row) => String(row.metadataJson).includes(contains));
          }
        }
        return ([...rows].sort((left, right) => compareRows(left, right))) as never;
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
        return ([...rows].sort((left, right) => compareRows(left, right))) as never;
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

function compareRows(left: Record<string, unknown>, right: Record<string, unknown>) {
  const leftTime = new Date(String(left.updatedAt ?? left.createdAt ?? left.startedAt)).valueOf();
  const rightTime = new Date(String(right.updatedAt ?? right.createdAt ?? right.startedAt)).valueOf();
  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return Number(left.id) - Number(right.id);
}
