import assert from "node:assert/strict";
import { test } from "node:test";
import type { RemixSearchCandidate } from "@track-lab/api-types";
import { RemixSearchOrchestrator } from "../orchestrator.ts";
import { soundCloudWebSearchInternals } from "../providers/soundcloud-web-search.ts";
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

test("soundcloud web search keeps only track urls", () => {
  assert.equal(
    soundCloudWebSearchInternals.getSoundCloudTrackUrl(
      "https://soundcloud.com/zekebeats/babatunde-zeke-beats-remix?utm_source=test",
    ),
    "https://soundcloud.com/zekebeats/babatunde-zeke-beats-remix",
  );
  assert.equal(
    soundCloudWebSearchInternals.getSoundCloudTrackUrl(
      "https://soundcloud.com/search?q=babatunde%20remix",
    ),
    null,
  );
  assert.equal(
    soundCloudWebSearchInternals.getSoundCloudTrackUrl(
      "https://soundcloud.com/sets/babatunde-remixes",
    ),
    null,
  );
  assert.equal(
    soundCloudWebSearchInternals.getSoundCloudTrackUrl(
      "https://soundcloud.com/user-630150470/sets/abba-remix-club-dance",
    ),
    null,
  );
});

test("soundcloud web search parses public fallback links", () => {
  const results = soundCloudWebSearchInternals.parseSoundCloudSearchHtml(`
    <li><h2><a href="/moonman1135/abba-gimme-gimme-gimme-club">ABBA - Gimme Gimme Gimme (Club Remix)</a></h2></li>
    <li><h2><a href="/user-630150470/sets/abba-remix-club-dance">ABBA Remix Club &amp; Dance</a></h2></li>
    <li><h2><a href="/vizonn/abba-gimme-gimme-gimme-vizon-remix-free-dl">ABBA - Gimme! Gimme! Gimme! (VIZON Remix) [Free DL]</a></h2></li>
  `);

  assert.deepEqual(results, [
    {
      title: "ABBA - Gimme Gimme Gimme (Club Remix)",
      url: "https://soundcloud.com/moonman1135/abba-gimme-gimme-gimme-club",
    },
    {
      title: "ABBA Remix Club & Dance",
      url: "https://soundcloud.com/user-630150470/sets/abba-remix-club-dance",
    },
    {
      title: "ABBA - Gimme! Gimme! Gimme! (VIZON Remix) [Free DL]",
      url: "https://soundcloud.com/vizonn/abba-gimme-gimme-gimme-vizon-remix-free-dl",
    },
  ]);
});

test("soundcloud web search parses track page uploaded date", () => {
  const metadata =
    soundCloudWebSearchInternals.parseSoundCloudTrackPageMetadata(`
      <article itemscope itemtype="http://schema.org/MusicRecording">
        published on <time pubdate>2020-09-29T20:06:47Z</time>
      </article>
      <script>window.__sc_hydration = [{"hydratable":"sound","data":{"created_at":"2020-09-29T20:06:47Z","display_date":"2020-09-29T20:06:47Z","duration":168855,"genre":"Dance \\u0026 EDM","tag_list":"house remix"}}];</script>
    `);

  assert.deepEqual(metadata, {
    createdAt: "2020-09-29T20:06:47Z",
    durationMs: 168855,
    genre: "Dance & EDM",
    subGenre: "house remix",
  });
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
