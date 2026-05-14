import assert from "node:assert/strict";
import { test } from "node:test";
import type { RemixSearchCandidate } from "@track-lab/api-types";
import { RemixSearchOrchestrator } from "../orchestrator.ts";
import { createRemixSearchQueries } from "../query-planner.ts";
import { rankRemixCandidates } from "../scoring.ts";

test("query planner creates remix and genre search variants", () => {
  const queries = createRemixSearchQueries({
    title: "Babatunde",
    artists: "Peekaboo, G-Rex",
    genre: "bass",
    spotifyUrl: null,
  });

  assert.ok(queries.includes("Peekaboo Babatunde remix"));
  assert.ok(queries.includes("Peekaboo Babatunde bass"));
  assert.ok(queries.includes("Babatunde bass remix"));
});

test("orchestrator validates title and artists or spotify url", async () => {
  const orchestrator = new RemixSearchOrchestrator([]);

  await assert.rejects(
    () => orchestrator.search({ title: "Babatunde" }),
    /Provide a Spotify URL or both title and artists/,
  );
});

test("ranker prefers matching bass remix candidates", () => {
  const ranked = rankRemixCandidates(
    [
      candidate({
        title: "Babatunde (ZEKE BEATS Remix)",
        artists: "Peekaboo & G-Rex",
        genre: "Dubstep",
        subGenre: "Bass",
      }),
      candidate({
        title: "Completely Different Song",
        artists: "Someone Else",
        genre: "Pop",
      }),
    ],
    {
      title: "Babatunde",
      artists: "Peekaboo, G-Rex",
      genre: "bass",
      spotifyUrl: null,
    },
  );

  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]?.title, "Babatunde (ZEKE BEATS Remix)");
  assert.ok(ranked[0]?.confidence >= 80);
});

test("ranker accepts minor title typos and rejects unrelated same-artist remixes", () => {
  const ranked = rankRemixCandidates(
    [
      candidate({
        title: "ABBA - Gimme Gimme Gimme (Club Remix)",
        artists: "Moonman",
      }),
      candidate({
        title: "S.O.S - ABBA (Remix)",
        artists: "Helt Serr",
      }),
    ],
    {
      title: "Gimmi",
      artists: "abba",
      genre: null,
      spotifyUrl: null,
    },
  );

  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]?.title, "ABBA - Gimme Gimme Gimme (Club Remix)");
});

test("ranker rejects same-title remixes without requested original artist evidence", () => {
  const ranked = rankRemixCandidates(
    [
      candidate({
        title: "Kumarion - Want It (Chaotic Good Flip)",
        artists: "Chaotic Good",
      }),
      candidate({
        title: "PEEKABOO - Want It (House Edit)",
        artists: "Test DJ",
      }),
    ],
    {
      title: "Want It",
      artists: "PEEKABOO",
      genre: null,
      spotifyUrl: null,
    },
  );

  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]?.title, "PEEKABOO - Want It (House Edit)");
});

test("ranker rejects original track releases without remix evidence", () => {
  const ranked = rankRemixCandidates(
    [
      candidate({
        title: "Want It",
        artists: "PEEKABOO",
      }),
      candidate({
        title: "Want It",
        artists: "PEEKABOO, borne",
      }),
      candidate({
        title: "PEEKABOO - Want It (House Edit)",
        artists: "Test DJ",
      }),
    ],
    {
      title: "Want It",
      artists: "PEEKABOO",
      genre: null,
      spotifyUrl: null,
    },
  );

  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]?.title, "PEEKABOO - Want It (House Edit)");
});

function candidate(
  overrides: Partial<RemixSearchCandidate>,
): RemixSearchCandidate {
  return {
    title: "Babatunde",
    artists: "Peekaboo & G-Rex",
    remixArtist: null,
    album: null,
    genre: null,
    subGenre: null,
    bpm: null,
    provider: "SoundCloud",
    link: `https://soundcloud.com/test/${Math.random()}`,
    createdAt: "2019-01-01T00:00:00Z",
    durationMs: 180000,
    confidence: 0,
    relevanceReason: "",
    ...overrides,
  };
}
