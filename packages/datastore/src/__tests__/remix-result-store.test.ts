import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { RemixResultStore } from "../remix-result-store.ts";

test("remix store saves and lists remixes", () => {
  const store = createStore();
  const saved = store.saveRemix({
    originalTrack: {
      title: "Gimme",
      artists: "ABBA",
      spotifyUrl: null,
    },
    requestedGenre: "bass",
    candidate: {
      title: "ABBA - Gimme (Bass Remix)",
      artists: "DJ Test",
      remixArtist: "DJ Test",
      album: null,
      genre: "Bass",
      subGenre: "future bass",
      bpm: null,
      provider: "SoundCloud",
      link: "https://soundcloud.com/test/gimme-bass-remix",
      createdAt: "2025-01-01T00:00:00Z",
      durationMs: 180000,
      confidence: 92,
      relevanceReason: "Strong bass remix evidence.",
    },
  });

  assert.equal(saved.id > 0, true);
  assert.equal(saved.originalTrack.title, "Gimme");
  assert.equal(saved.requestedGenre, "bass");

  const remixes = store.listRemixes();
  assert.equal(remixes.length, 1);
  assert.equal(remixes[0]?.title, "ABBA - Gimme (Bass Remix)");
  assert.equal(remixes[0]?.provider, "SoundCloud");
});

function createStore() {
  const directory = mkdtempSync(join(tmpdir(), "track-lab-remixes-"));
  return new RemixResultStore(join(directory, "test.sqlite"));
}
