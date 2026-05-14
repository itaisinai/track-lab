import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AgentSessionStore, TrackAnalysisJobStore } from "@track-lab/datastore";
import { TrackAnalysisOrchestrator } from "@track-lab/track-analysis";
import { AgentRuntime } from "../runtime.ts";

test("agent runtime asks for missing track fields without exposing provider tools", async () => {
  const store = createStore();
  const session = store.createSession();
  const runtime = new AgentRuntime({ store, useLlm: false });

  const response = await runtime.sendMessage(session.id, "analyze this track");

  assert.match(response.message.content, /track title and artist/i);
  assert.equal(response.toolCalls.length, 0);
});

test("agent runtime persists failed remix tool calls", async () => {
  const store = createStore();
  const session = store.createSession();
  const runtime = new AgentRuntime({
    store,
    useLlm: false,
    remixSearch: {
      search: async () => ({
        originalTrack: {
          title: "Strobe",
          artists: "deadmau5",
          spotifyUrl: null,
          album: null,
          durationMs: null,
        },
        requestedGenre: null,
        candidates: [],
      }),
    } as never,
  });

  const response = await runtime.sendMessage(
    session.id,
    "find remixes for Strobe by deadmau5",
  );

  assert.equal(response.toolCalls.length, 1);
  assert.equal(response.toolCalls[0]?.toolName, "search_remixes");
  assert.notEqual(response.toolCalls[0]?.toolName, "Spotify");
});

test("agent runtime enqueues analyze track jobs instead of running analysis inline", async () => {
  const store = createStore();
  const jobStore = createJobStore();
  const session = store.createSession();
  const runtime = new AgentRuntime({
    store,
    useLlm: false,
    trackAnalysis: new TrackAnalysisOrchestrator(jobStore),
  });

  const response = await runtime.sendMessage(
    session.id,
    "Hi, I want to analyze a track dracula by tame impala",
  );

  assert.equal(response.toolCalls.length, 1);
  assert.equal(response.toolCalls[0]?.toolName, "analyze_track");
  assert.deepEqual(response.toolCalls[0]?.arguments, {
    title: "dracula",
    artists: "tame impala",
    operation: "enrich",
  });
  assert.equal(response.message.metadata.analysisResult, undefined);
  assert.deepEqual(response.message.metadata.queuedTrackAnalysisJob, {
    id: 1,
    status: "queued",
    operation: "enrich",
  });
  assert.equal(jobStore.listJobs({ statuses: ["queued"] }).length, 1);
});

function createJobStore() {
  const directory = mkdtempSync(join(tmpdir(), "track-lab-agent-chat-jobs-"));
  return new TrackAnalysisJobStore(join(directory, "test.sqlite"));
}

function createStore() {
  const directory = mkdtempSync(join(tmpdir(), "track-lab-agent-chat-"));
  return new AgentSessionStore(join(directory, "test.sqlite"));
}
