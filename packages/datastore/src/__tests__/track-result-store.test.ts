import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TrackResultStore } from "../track-result-store.ts";

test("saved result status is complete when final metadata has bpm and genre", () => {
  const databasePath = join(mkdtempSync(join(tmpdir(), "track-lab-")), "db.sqlite");
  const store = new TrackResultStore(databasePath);

  const result = store.saveResult({
    rawResponse: "{}",
    json: {
      trackName: "Money Bag",
      artist: "Cardi B",
      album: "Money",
      bpm: 129,
      genre: "hip hop",
      subGenre: "trap",
      key: "A#m",
      status: "partial",
      toolsUsed: [
        { name: "Spotify", matched: true, url: "https://open.spotify.com/track/1" },
      ],
    },
  });

  assert.equal(result.status, "complete");
});
