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
      getSongBpmLookup: async () => {
        providerCalls += 1;
        return { bpm: 999, genre: "Should not call" };
      },
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
      getSongBpmLookup: async () => {
        calledProviders.push("getsongbpm");
        return {
          found: true,
          bpm: 78,
          genre: null,
          key: "C#m",
        };
      },
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
      getSongBpmLookup: async () => ({
        found: true,
        bpm: 128,
        genre: null,
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

test("output status reflects complete, partial, and missing states", async () => {
  const complete = await enrichTrackMetadata(
    { trackName: "A", artist: "B" },
    {
      spotifyLookup: async () => ({ bpm: null, genre: "House" }),
      getSongBpmLookup: async () => ({ bpm: 120, genre: null }),
      synthesize: async ({ baseResult }) => baseResult,
    },
  );
  const partial = await enrichTrackMetadata(
    { trackName: "A", artist: "B" },
    {
      spotifyLookup: async () => ({ bpm: null, genre: null }),
      getSongBpmLookup: async () => ({ bpm: 120, genre: null }),
      synthesize: async ({ baseResult }) => baseResult,
    },
  );
  const missing = await enrichTrackMetadata(
    { trackName: "A", artist: "B" },
    {
      spotifyLookup: async () => ({ bpm: null, genre: null }),
      getSongBpmLookup: async () => ({ bpm: null, genre: null }),
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
