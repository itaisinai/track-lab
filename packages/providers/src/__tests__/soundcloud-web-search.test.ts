import assert from "node:assert/strict";
import test from "node:test";
import { soundCloudWebSearchInternals } from "../index.ts";

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
