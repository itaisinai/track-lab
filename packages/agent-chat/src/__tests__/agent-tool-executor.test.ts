import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AgentSessionStore, TrackAnalysisJobStore } from "@track-lab/datastore";
import { TrackAnalysisOrchestrator } from "@track-lab/track-analysis";
import { AgentToolExecutor } from "../tools/agent-tool-executor.ts";

test("agent tool executor applies interpreted genre to contextual remix searches", async () => {
  const store = createStore();
  const jobStore = createJobStore();
  const session = store.createSession();
  store.updateSessionMetadata(session.id, {
    currentFocusTrack: {
      title: "strobe",
      artists: "deadmau5",
      spotifyUrl: null,
      genre: null,
    },
  });
  const requestMessage = store.addMessage({
    sessionId: session.id,
    role: "user",
    content: "find me bass remixes",
  });
  const executor = new AgentToolExecutor(
    store,
    new TrackAnalysisOrchestrator(jobStore),
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
    jobStore.listJobs({ statuses: ["queued"] })[0]?.payload,
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
  const directory = mkdtempSync(join(tmpdir(), "track-lab-agent-tool-jobs-"));
  return new TrackAnalysisJobStore(join(directory, "test.sqlite"));
}

function createStore() {
  const directory = mkdtempSync(join(tmpdir(), "track-lab-agent-tool-"));
  return new AgentSessionStore(join(directory, "test.sqlite"));
}
