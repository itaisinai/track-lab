import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AgentSessionStore } from "../agent-session-store.ts";

test("agent session store persists sessions, messages, and tool calls", () => {
  const store = createStore();
  const session = store.createSession("Discovery");

  const userMessage = store.addMessage({
    sessionId: session.id,
    role: "user",
    content: "Analyze Strobe by deadmau5",
  });
  const toolCall = store.startToolCall({
    sessionId: session.id,
    requestMessageId: userMessage.id,
    toolName: "analyze_track",
    arguments: {
      title: "Strobe",
      artists: "deadmau5",
    },
  });
  store.completeToolCall(toolCall.id, { status: "complete" });
  const assistantMessage = store.addMessage({
    sessionId: session.id,
    role: "assistant",
    content: "Analysis complete.",
    metadata: {
      toolCallIds: [toolCall.id],
      analysisResult: { status: "complete" },
    },
  });
  store.attachToolCallsToAssistantMessage([toolCall.id], assistantMessage.id);

  assert.equal(store.listSessions().length, 1);
  assert.deepEqual(
    store.listMessages(session.id).map((message) => message.role),
    ["user", "assistant"],
  );
  const calls = store.listToolCalls(session.id);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.status, "completed");
  assert.equal(calls[0]?.assistantMessageId, assistantMessage.id);
  assert.deepEqual(calls[0]?.result, { status: "complete" });
});

test("agent session store persists failed tool calls", () => {
  const store = createStore();
  const session = store.createSession();
  const userMessage = store.addMessage({
    sessionId: session.id,
    role: "user",
    content: "Find remixes",
  });
  const toolCall = store.startToolCall({
    sessionId: session.id,
    requestMessageId: userMessage.id,
    toolName: "search_remixes",
    arguments: {
      title: null,
      artists: null,
      spotifyUrl: null,
      genre: null,
    },
  });

  store.failToolCall(toolCall.id, "Provide a Spotify URL or both title and artists.");

  const calls = store.listToolCalls(session.id);
  assert.equal(calls[0]?.status, "failed");
  assert.equal(
    calls[0]?.errorMessage,
    "Provide a Spotify URL or both title and artists.",
  );
});

test("agent session store persists session metadata", () => {
  const store = createStore();
  const session = store.createSession("Discovery");

  store.updateSessionMetadata(session.id, {
    currentFocusTrack: {
      title: "Animals",
      artists: "Martin Garrix",
      spotifyUrl: null,
    },
  });
  store.updateSessionMetadata(session.id, (current) => ({
    ...current,
    latestTrackResultId: 12,
  }));

  assert.deepEqual(store.getSession(session.id)?.metadata, {
    currentFocusTrack: {
      title: "Animals",
      artists: "Martin Garrix",
      spotifyUrl: null,
    },
    latestTrackResultId: 12,
  });
});

test("agent session store deletes a session and cascades chat history", () => {
  const store = createStore();
  const session = store.createSession("Discovery");
  const message = store.addMessage({
    sessionId: session.id,
    role: "user",
    content: "Analyze Animals by Martin Garrix",
  });
  store.startToolCall({
    sessionId: session.id,
    requestMessageId: message.id,
    toolName: "analyze_track",
    arguments: {
      title: "Animals",
      artists: "Martin Garrix",
    },
  });

  assert.equal(store.deleteSession(session.id), true);
  assert.equal(store.getSession(session.id), null);
  assert.deepEqual(store.listMessages(session.id), []);
  assert.deepEqual(store.listToolCalls(session.id), []);
  assert.equal(store.deleteSession(session.id), false);
});

test("agent session store updates a session title", () => {
  const store = createStore();
  const session = store.createSession();

  const updated = store.updateSessionTitle(session.id, "Animals by Martin Garrix");

  assert.equal(updated.title, "Animals by Martin Garrix");
  assert.equal(store.getSession(session.id)?.title, "Animals by Martin Garrix");
});

test("agent session store syncs completed analysis job title from result", () => {
  const store = createStore();
  const session = store.createSession();
  store.addMessage({
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

  store.syncCompletedAnalysisJob({
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

  const updated = store.getSession(session.id);
  assert.equal(updated?.title, "Want It by PEEKABOO");
  assert.deepEqual(updated?.metadata.currentFocusTrack, {
    title: "Want It",
    artists: "PEEKABOO",
  });
});

test("agent session store does not sync completed analysis job to partial id matches", () => {
  const store = createStore();
  const session = store.createSession("Strobe by deadmau5");
  store.addMessage({
    sessionId: session.id,
    role: "assistant",
    content: "Queued track analysis job #122.",
    metadata: {
      queuedTrackAnalysisJob: {
        id: 122,
        status: "queued",
        operation: "enrich",
      },
    },
  });

  store.syncCompletedAnalysisJob({
    id: 12,
    operation: "enrich",
    status: "completed",
    payload: {
      operation: "enrich",
      track: {
        title: "Hot honey",
        artists: "Liad Meir",
      },
      source: "manual",
    },
    result: {
      trackName: "Hot Honey",
      artist: "Liad Meir",
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

  const unchanged = store.getSession(session.id);
  assert.equal(unchanged?.title, "Strobe by deadmau5");
  assert.deepEqual(unchanged?.metadata, {});
});

function createStore() {
  const directory = mkdtempSync(join(tmpdir(), "track-lab-agent-"));
  return new AgentSessionStore(join(directory, "test.sqlite"));
}
