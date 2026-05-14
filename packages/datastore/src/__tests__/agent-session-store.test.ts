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

function createStore() {
  const directory = mkdtempSync(join(tmpdir(), "track-lab-agent-"));
  return new AgentSessionStore(join(directory, "test.sqlite"));
}
