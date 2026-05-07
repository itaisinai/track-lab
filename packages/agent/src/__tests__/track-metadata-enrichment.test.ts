import assert from "node:assert/strict";
import test from "node:test";
import type {
  TrackMetadataProvider,
  TrackMetadataProviderInput,
  TrackMetadataProviderResult,
} from "@track-lab/providers";
import type { EnrichmentResultStore } from "../enrichment/enrichment-result-store.ts";
import { enrichTrackMetadata } from "../enrichment/track-metadata-enrichment.ts";

test("analyze reuses local DB data before provider lookup", async () => {
  let providerCalls = 0;

  const result = await enrichTrackMetadata(
    { operation: "analyze", trackName: "HUMBLE.", artist: "Kendrick Lamar" },
    {
      store: localStore(),
      providers: [
        metadataProvider("Spotify", "spotify", () => {
          providerCalls += 1;
          return { genre: "Should not call", source: "spotify", confidence: 0.65 };
        }),
      ],
      contextProviders: [],
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

test("enrich skips local DB and keeps higher-confidence known metadata", async () => {
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
      providers: [
        metadataProvider("Spotify", "spotify", () => {
          calledProviders.push("spotify");
          return {
            genre: "Rap",
            album: "DAMN.",
            url: "https://open.spotify.com/track/demo",
            matchedTrack: {
              title: "HUMBLE.",
              artists: "Kendrick Lamar",
            },
            source: "spotify",
            confidence: 0.65,
          };
        }),
        metadataProvider("GetSongBPM", "getsongbpm", () => {
          calledProviders.push("getsongbpm");
          return {
            bpm: 78,
            key: "C#m",
            source: "getsongbpm",
            confidence: 0.65,
          };
        }),
      ],
      contextProviders: [],
      synthesize: async ({ baseResult }) => baseResult,
    },
  );

  assert.deepEqual(calledProviders, ["spotify"]);
  assert.equal(result.bpm, 76);
  assert.equal(result.genre, "Hip Hop");
  assert.equal(result.key, "A Minor");
  assert.equal(result.album, "DAMN.");
  assert.equal(result.spotifyUrl, "https://open.spotify.com/track/demo");
  assert.deepEqual(
    result.toolsUsed?.map((tool) => tool.name),
    ["Spotify"],
  );
  assert.deepEqual(result.changedFields, ["album", "spotifyUrl"]);
});

test("enrichment calls metadata providers in order and fills missing fields later", async () => {
  const calledProviders: string[] = [];

  const result = await enrichTrackMetadata(
    { operation: "analyze", trackName: "Strobe", artist: "Deadmau5" },
    {
      providers: [
        metadataProvider("Spotify", "spotify", () => {
          calledProviders.push("spotify");
          return {
            genre: "Progressive House",
            album: "For Lack of a Better Name",
            matchedTrack: {
              title: "Strobe",
              artists: "deadmau5",
            },
            source: "spotify",
            confidence: 0.65,
            raw: { providerShape: "spotify" },
          };
        }),
        metadataProvider("GetSongBPM", "getsongbpm", () => {
          calledProviders.push("getsongbpm");
          return {
            bpm: 128,
            source: "getsongbpm",
            confidence: 0.65,
            raw: { providerShape: "getsongbpm" },
          };
        }),
        metadataProvider("Beatport", "beatport", () => {
          calledProviders.push("beatport");
          return {
            bpm: 130,
            genre: "Techno",
            source: "beatport",
            confidence: 0.85,
          };
        }),
      ],
      contextProviders: [],
      synthesize: async ({ baseResult, providerEvidence }) => {
        assert.deepEqual(providerEvidence.spotify, { providerShape: "spotify" });
        assert.deepEqual(providerEvidence.getSongBpm, {
          providerShape: "getsongbpm",
        });
        return {
          ...baseResult,
          summary: "Provider evidence found BPM and genre.",
        };
      },
    },
  );

  assert.deepEqual(calledProviders, ["spotify", "getsongbpm"]);
  assert.equal(result.bpm, 128);
  assert.equal(result.genre, "Progressive House");
  assert.equal(result.album, "For Lack of a Better Name");
  assert.equal(result.sources.bpm, "getsongbpm");
  assert.equal(result.sources.genre, "spotify");
  assert.equal(result.status, "complete");
  assert.equal(result.summary, "Provider evidence found BPM and genre.");
});

test("higher-confidence provider can replace weaker metadata before early stop", async () => {
  const result = await enrichTrackMetadata(
    { operation: "analyze", trackName: "I AM BASS", artist: "LSDREAM" },
    {
      providers: [
        metadataProvider("Spotify", "spotify", () => ({
          bpm: 144,
          genre: "Electronic",
          album: "RENAGADES OF LIGHT",
          matchedTrack: {
            title: "I AM BASS",
            artists: "LSDREAM",
          },
          source: "spotify",
          confidence: 0.55,
        })),
        metadataProvider("Beatport", "beatport", () => ({
          bpm: 145,
          genre: "Dance / Pop",
          key: "E Major",
          source: "beatport",
          confidence: 0.85,
        })),
      ],
      contextProviders: [],
      synthesize: async ({ baseResult }) => baseResult,
    },
  );

  assert.equal(result.bpm, 145);
  assert.equal(result.genre, "Dance / Pop");
  assert.equal(result.key, "E Major");
  assert.equal(result.sources.bpm, "beatport");
  assert.equal(result.sources.genre, "beatport");
  assert.equal(result.sources.key, "beatport");
});

test("lower-confidence provider does not overwrite higher-confidence data", async () => {
  const result = await enrichTrackMetadata(
    { operation: "analyze", trackName: "Feeling Good", artist: "Avicii" },
    {
      providers: [
        metadataProvider("Beatport", "beatport", () => ({
          bpm: 104,
          genre: "House",
          key: "B Minor",
          source: "beatport",
          confidence: 0.85,
        })),
        metadataProvider("Last.fm", "lastfm", () => ({
          genre: "Pop",
          tags: ["pop", "dance"],
          source: "lastfm",
          confidence: 0.45,
        })),
      ],
      contextProviders: [],
      synthesize: async ({ baseResult }) => baseResult,
    },
  );

  assert.equal(result.bpm, 104);
  assert.equal(result.genre, "House");
  assert.equal(result.key, "B Minor");
  assert.equal(result.sources.genre, "beatport");
});

test("context provider raw evidence is isolated from output and passed to synthesis", async () => {
  let synthesisWikipediaEvidence: unknown = null;

  const result = await enrichTrackMetadata(
    { operation: "analyze", trackName: "I AM BASS", artist: "LSDREAM" },
    {
      providers: [
        metadataProvider("Spotify", "spotify", () => ({
          album: "RENAGADES OF LIGHT",
          matchedTrack: {
            title: "I AM BASS",
            artists: "LSDREAM",
          },
          source: "spotify",
          confidence: 0.65,
        })),
        metadataProvider("GetSongBPM", "getsongbpm", () => ({
          bpm: 144,
          source: "getsongbpm",
          confidence: 0.65,
        })),
      ],
      contextProviders: [
        metadataProvider("Wikipedia", "wikipedia", () => ({
          tags: ["bass music"],
          url: "https://en.wikipedia.org/wiki/LSDREAM",
          source: "wikipedia",
          confidence: 0.45,
          raw: {
            found: true,
            source: "wikipedia",
            title: "LSDREAM",
            extract: "LSDREAM is associated with bass music.",
            url: "https://en.wikipedia.org/wiki/LSDREAM",
          },
        })),
      ],
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
  assert.equal("raw" in result, false);
  assert.deepEqual(result.toolsUsed?.at(-1), {
    name: "Wikipedia",
    matched: true,
    url: "https://en.wikipedia.org/wiki/LSDREAM",
    error: null,
  });
});

test("synthesis cannot replace matched track identity", async () => {
  const result = await enrichTrackMetadata(
    { operation: "analyze", trackName: "כנפיים", artist: "טונה" },
    {
      providers: [
        metadataProvider("Spotify", "spotify", () => ({
          genre: "Pop",
          matchedTrack: {
            title: "כנפיים",
            artists: "Tuna",
          },
          source: "spotify",
          confidence: 0.65,
        })),
      ],
      contextProviders: [],
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
      providers: [
        metadataProvider("Spotify", "spotify", () => ({
          genre: "House",
          source: "spotify",
          confidence: 0.65,
        })),
        metadataProvider("GetSongBPM", "getsongbpm", () => ({
          bpm: 120,
          source: "getsongbpm",
          confidence: 0.65,
        })),
      ],
      contextProviders: [],
      synthesize: async ({ baseResult }) => baseResult,
    },
  );
  const partial = await enrichTrackMetadata(
    { trackName: "A", artist: "B" },
    {
      providers: [
        metadataProvider("GetSongBPM", "getsongbpm", () => ({
          bpm: 120,
          source: "getsongbpm",
          confidence: 0.65,
        })),
      ],
      contextProviders: [],
      synthesize: async ({ baseResult }) => baseResult,
    },
  );
  const missing = await enrichTrackMetadata(
    { trackName: "A", artist: "B" },
    {
      providers: [],
      contextProviders: [],
      synthesize: async ({ baseResult }) => baseResult,
    },
  );

  assert.equal(complete.status, "complete");
  assert.equal(partial.status, "partial");
  assert.equal(missing.status, "missing");
});

function metadataProvider(
  name: string,
  source: string,
  lookup: (
    input: TrackMetadataProviderInput,
  ) => TrackMetadataProviderResult | null | Promise<TrackMetadataProviderResult | null>,
): TrackMetadataProvider {
  return {
    name,
    lookup: async (input) => {
      const result = await lookup(input);

      if (!result) {
        return null;
      }

      return {
        ...result,
        source: result.source || source,
      };
    },
  };
}

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
