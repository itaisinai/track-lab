import assert from "node:assert/strict";
import test from "node:test";
import { enrichTrackMetadata } from "../enrichment/track-metadata-enrichment.ts";
import type { EnrichmentResultStore } from "../enrichment/enrichment-result-store.ts";

test("analyze reuses local DB data before provider lookup", async () => {
  let providerCalls = 0;

  const result = await enrichTrackMetadata(
    { operation: "analyze", trackName: "HUMBLE.", artist: "Kendrick Lamar" },
    {
      store: localStore(),
      spotifyLookup: async () => {
        providerCalls += 1;
        return { bpm: null, genre: "Should not call" };
      },
      beatportLookup: async () => {
        providerCalls += 1;
        return { bpm: 999, genre: "Should not call" };
      },
      getSongBpmLookup: async () => {
        providerCalls += 1;
        return { bpm: 999, genre: "Should not call" };
      },
      wikipediaLookup: async () => noWikipedia(),
      decideBeatportSearch: async () => ({
        shouldSearch: false,
        classification: "not_edm",
      }),
      synthesize: async ({ baseResult }) => baseResult,
    },
  );

  assert.equal(providerCalls, 0);
  assert.equal(result.bpm, 76);
  assert.equal(result.genre, "Hip Hop");
  assert.equal(result.key, "A Minor");
  assert.equal(result.sources.bpm, "local_db");
  assert.equal(result.sources.genre, "local_db");
  assert.equal(result.status, "complete");
});

test("enrich skips local DB and refreshes provider evidence", async () => {
  const calledProviders: string[] = [];

  const result = await enrichTrackMetadata(
    {
      operation: "enrich",
      trackName: "HUMBLE.",
      artist: "Kendrick Lamar",
      knownMetadata: {
        album: null,
        bpm: 76,
        genre: "Hip Hop",
        key: "A Minor",
        spotifyUrl: null,
      },
    },
    {
      store: localStore(),
      spotifyLookup: async () => {
        calledProviders.push("spotify");
        return {
          found: true,
          bpm: null,
          genre: "Rap",
          track: {
            title: "HUMBLE.",
            artists: ["Kendrick Lamar"],
            album: "DAMN.",
            spotifyUrl: "https://open.spotify.com/track/demo",
          },
          url: "https://open.spotify.com/track/demo",
        };
      },
      beatportLookup: async () => {
        calledProviders.push("beatport");
        return {
          found: true,
          bpm: 76,
          genre: "Hip-Hop",
          subGenre: "Rap",
          key: "A Minor",
        };
      },
      getSongBpmLookup: async () => {
        calledProviders.push("getsongbpm");
        return {
          found: true,
          bpm: 78,
          genre: null,
          key: "C#m",
        };
      },
      wikipediaLookup: async () => noWikipedia(),
      synthesize: async ({ baseResult }) => baseResult,
    },
  );

  assert.deepEqual(calledProviders, ["spotify", "getsongbpm"]);
  assert.equal(result.bpm, 76);
  assert.equal(result.genre, "Hip Hop");
  assert.equal(result.album, "DAMN.");
  assert.equal(result.spotifyUrl, "https://open.spotify.com/track/demo");
  assert.deepEqual(
    result.toolsUsed?.map((tool) => tool.name),
    ["Spotify", "GetSongBPM", "Wikipedia"],
  );
  assert.deepEqual(result.changedFields, ["album", "spotifyUrl"]);
});

test("provider data completes missing analyze results", async () => {
  const result = await enrichTrackMetadata(
    { operation: "analyze", trackName: "Strobe", artist: "Deadmau5" },
    {
      spotifyLookup: async () => ({
        found: true,
        bpm: null,
        genre: "Progressive House",
        track: {
          title: "Strobe",
          artists: ["deadmau5"],
          album: "For Lack of a Better Name",
        },
      }),
      beatportLookup: async () => ({
        found: false,
        bpm: null,
        genre: null,
        key: null,
      }),
      getSongBpmLookup: async () => ({
        found: true,
        bpm: 128,
        genre: null,
      }),
      wikipediaLookup: async () => noWikipedia(),
      decideBeatportSearch: async () => ({
        shouldSearch: true,
        classification: "edm",
      }),
      synthesize: async ({ baseResult }) => ({
        ...baseResult,
        summary: "Provider evidence found BPM and genre.",
      }),
    },
  );

  assert.equal(result.bpm, 128);
  assert.equal(result.genre, "Progressive House");
  assert.equal(result.album, "For Lack of a Better Name");
  assert.equal(result.status, "complete");
  assert.equal(result.summary, "Provider evidence found BPM and genre.");
});

test("wikipedia context is passed to synthesis when genre context is missing", async () => {
  let synthesisWikipediaEvidence: unknown = null;

  const result = await enrichTrackMetadata(
    { operation: "analyze", trackName: "I AM BASS", artist: "LSDREAM" },
    {
      spotifyLookup: async () => ({
        found: true,
        bpm: null,
        genre: null,
        genres: [],
        track: {
          title: "I AM BASS",
          artists: ["LSDREAM"],
          album: "RENAGADES OF LIGHT",
          artistGenres: [],
        },
      }),
      beatportLookup: async () => ({
        found: false,
        bpm: null,
        genre: null,
        key: null,
      }),
      getSongBpmLookup: async () => ({
        found: true,
        bpm: 144,
        genre: null,
      }),
      wikipediaLookup: async () => ({
        found: true,
        source: "wikipedia",
        title: "LSDREAM",
        extract: "LSDREAM is associated with bass music.",
        url: "https://en.wikipedia.org/wiki/LSDREAM",
      }),
      synthesize: async ({ baseResult, providerEvidence }) => {
        synthesisWikipediaEvidence = providerEvidence.wikipedia;
        return {
          ...baseResult,
          genre: "Bass",
          subGenre: "Experimental bass",
          summary: "Artist context suggests this fits bass-focused sets.",
        };
      },
    },
  );

  assert.deepEqual(synthesisWikipediaEvidence, {
    found: true,
    source: "wikipedia",
    title: "LSDREAM",
    extract: "LSDREAM is associated with bass music.",
    url: "https://en.wikipedia.org/wiki/LSDREAM",
  });
  assert.equal(result.genre, "Bass");
  assert.equal(result.subGenre, "Experimental bass");
  assert.equal(result.summary, "Artist context suggests this fits bass-focused sets.");
  assert.deepEqual(result.toolsUsed?.at(-1), {
    name: "Wikipedia",
    matched: true,
    url: "https://en.wikipedia.org/wiki/LSDREAM",
    error: null,
  });
});

test("beatport evidence fills DJ catalog metadata", async () => {
  const result = await enrichTrackMetadata(
    { operation: "analyze", trackName: "I AM BASS", artist: "LSDREAM" },
    {
      spotifyLookup: async () => ({
        found: true,
        bpm: null,
        genre: null,
        track: {
          title: "I AM BASS",
          artists: ["LSDREAM"],
          album: "RENAGADES OF LIGHT",
        },
      }),
      beatportLookup: async () => ({
        found: true,
        bpm: 145,
        genre: "Dance / Pop",
        subGenre: null,
        key: "E Major",
        url: "https://www.beatport.com/track/i-am-bass/11777847",
        track: {
          title: "I AM BASS",
          artists: ["LSDREAM"],
          album: "RENAGADES OF LIGHT",
        },
      }),
      getSongBpmLookup: async () => ({
        found: false,
        bpm: null,
        genre: null,
      }),
      wikipediaLookup: async () => noWikipedia(),
      decideBeatportSearch: async () => ({
        shouldSearch: true,
        classification: "edm",
      }),
      synthesize: async ({ baseResult, providerEvidence }) => ({
        ...baseResult,
        summary: providerEvidence.beatport
          ? "Beatport found track-level DJ metadata."
          : null,
      }),
    },
  );

  assert.equal(result.bpm, 145);
  assert.equal(result.genre, "Dance / Pop");
  assert.equal(result.key, "E Major");
  assert.equal(result.sources.bpm, "beatport");
  assert.equal(result.sources.genre, "beatport");
  assert.equal(result.sources.key, "beatport");
  assert.deepEqual(
    result.toolsUsed?.map((tool) => tool.name),
    ["Spotify", "GetSongBPM", "Beatport", "Wikipedia"],
  );
});

test("beatport accepts featured-title matches with partial artist overlap", async () => {
  const result = await enrichTrackMetadata(
    {
      operation: "analyze",
      trackName: "Push",
      artist: "Skrillex, Hamdi, TAICHU, OFFAIAH, contra",
    },
    {
      spotifyLookup: async () => ({
        found: true,
        bpm: null,
        genre: null,
        track: {
          title: "Push",
          artists: ["Skrillex", "Hamdi", "TAICHU", "OFFAIAH", "contra"],
          album: null,
        },
      }),
      getSongBpmLookup: async () => ({
        found: false,
        bpm: null,
        genre: null,
      }),
      beatportLookup: async () => ({
        found: true,
        bpm: 140,
        genre: "Deep Dubstep",
        key: "Ab Minor",
        track: {
          title: "Push (feat. OFFAIAH)",
          artists: ["Skrillex", "Taichu", "Hamdi", "OFFAIAH"],
        },
      }),
      wikipediaLookup: async () => noWikipedia(),
      decideBeatportSearch: async () => ({
        shouldSearch: true,
        classification: "edm",
      }),
      synthesize: async ({ baseResult }) => baseResult,
    },
  );

  assert.equal(result.bpm, 140);
  assert.equal(result.genre, "Deep Dubstep");
  assert.equal(result.key, "Ab Minor");
  assert.equal(result.trackName, "Push");
});

test("beatport ignores public first row when artist does not match", async () => {
  let beatportCalled = false;
  const result = await enrichTrackMetadata(
    { operation: "enrich", trackName: "כנפיים", artist: "טונה" },
    {
      spotifyLookup: async () => ({
        found: true,
        bpm: null,
        genre: null,
        track: {
          title: "כנפיים",
          artists: ["Tuna"],
          album: null,
        },
      }),
      beatportLookup: async () => {
        beatportCalled = true;
        return {
          found: true,
          bpm: 134,
          genre: "Pop",
          key: "A Minor",
          track: {
            title: "שורשים/כנפיים",
            artists: ["גיא ויהל"],
            album: "ועכשיו לחלק האינטרגלקטי",
          },
        };
      },
      getSongBpmLookup: async () => ({
        found: false,
        bpm: null,
        genre: null,
      }),
      wikipediaLookup: async () => noWikipedia(),
      decideBeatportSearch: async () => ({
        shouldSearch: false,
        classification: "not_edm",
      }),
      synthesize: async ({ baseResult }) => baseResult,
    },
  );

  assert.equal(result.trackName, "כנפיים");
  assert.equal(result.artist, "Tuna");
  assert.equal(beatportCalled, false);
});

test("beatport runs when other providers do not identify the track", async () => {
  const result = await enrichTrackMetadata(
    { operation: "analyze", trackName: "Unknown EDM Cut", artist: "Unknown DJ" },
    {
      spotifyLookup: async () => ({
        found: false,
        bpm: null,
        genre: null,
        track: null,
        url: null,
      }),
      getSongBpmLookup: async () => ({
        found: false,
        bpm: null,
        genre: null,
        track: null,
        url: null,
      }),
      beatportLookup: async () => ({
        found: true,
        bpm: 128,
        genre: "Tech House",
        key: "G Minor",
      }),
      wikipediaLookup: async () => noWikipedia(),
      synthesize: async ({ baseResult }) => baseResult,
    },
  );

  assert.equal(result.bpm, 128);
  assert.equal(result.genre, "Tech House");
  assert.equal(result.key, "G Minor");
  assert.deepEqual(
    result.toolsUsed?.map((tool) => tool.name),
    ["Spotify", "GetSongBPM", "Beatport", "Wikipedia"],
  );
});

test("synthesis cannot replace matched track identity", async () => {
  const result = await enrichTrackMetadata(
    { operation: "analyze", trackName: "כנפיים", artist: "טונה" },
    {
      spotifyLookup: async () => ({
        found: true,
        bpm: null,
        genre: "Pop",
        track: {
          title: "כנפיים",
          artists: ["Tuna"],
          album: null,
        },
      }),
      beatportLookup: async () => ({
        found: false,
        bpm: null,
        genre: null,
      }),
      getSongBpmLookup: async () => ({
        found: false,
        bpm: null,
        genre: null,
      }),
      wikipediaLookup: async () => noWikipedia(),
      decideBeatportSearch: async () => ({
        shouldSearch: false,
        classification: "not_edm",
      }),
      synthesize: async ({ baseResult }) => ({
        ...baseResult,
        trackName: "שורשים/כנפיים",
        artist: "גיא ויהל",
      }),
    },
  );

  assert.equal(result.trackName, "כנפיים");
  assert.equal(result.artist, "Tuna");
});

test("output status reflects complete, partial, and missing states", async () => {
  const complete = await enrichTrackMetadata(
    { trackName: "A", artist: "B" },
    {
      spotifyLookup: async () => ({ bpm: null, genre: "House" }),
      beatportLookup: async () => ({ bpm: null, genre: null }),
      getSongBpmLookup: async () => ({ bpm: 120, genre: null }),
      wikipediaLookup: async () => noWikipedia(),
      synthesize: async ({ baseResult }) => baseResult,
    },
  );
  const partial = await enrichTrackMetadata(
    { trackName: "A", artist: "B" },
    {
      spotifyLookup: async () => ({ bpm: null, genre: null }),
      beatportLookup: async () => ({ bpm: null, genre: null }),
      getSongBpmLookup: async () => ({ bpm: 120, genre: null }),
      wikipediaLookup: async () => noWikipedia(),
      synthesize: async ({ baseResult }) => baseResult,
    },
  );
  const missing = await enrichTrackMetadata(
    { trackName: "A", artist: "B" },
    {
      spotifyLookup: async () => ({ bpm: null, genre: null }),
      beatportLookup: async () => ({ bpm: null, genre: null }),
      getSongBpmLookup: async () => ({ bpm: null, genre: null }),
      wikipediaLookup: async () => noWikipedia(),
      synthesize: async ({ baseResult }) => baseResult,
    },
  );

  assert.equal(complete.status, "complete");
  assert.equal(partial.status, "partial");
  assert.equal(missing.status, "missing");
});

function localStore(): EnrichmentResultStore {
  return {
    findByTrack: () => ({
      id: 1,
      title: "HUMBLE.",
      artists: "Kendrick Lamar",
      album: null,
      bpm: 76,
      genre: "Hip Hop",
      subGenre: null,
      key: "A Minor",
      summary: null,
      status: "complete",
      toolsUsed: [],
      errors: [],
      json: {},
      rawResponse: "{}",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  };
}

function noWikipedia() {
  return {
    found: false,
    source: "wikipedia" as const,
    title: null,
    extract: null,
    url: null,
    error: null,
  };
}
