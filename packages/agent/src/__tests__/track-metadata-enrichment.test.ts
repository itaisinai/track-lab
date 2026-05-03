import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { enrichTrackMetadata } from "../enrichment/track-metadata-enrichment.ts";
import type { EnrichmentResultStore } from "../enrichment/enrichment-result-store.ts";

test("track found in Rekordbox XML with BPM and genre", async () => {
  const xmlPath = await writeRekordboxXml(`
    <TRACK Name="HUMBLE." Artist="Kendrick Lamar" AverageBpm="76.00" Genre="Hip Hop" Tonality="A Minor" Location="file://localhost/Users/demo/HUMBLE.mp3" />
  `);

  const result = await enrichTrackMetadata({
    trackName: "humble",
    artist: "kendrick lamar",
    rekordboxXmlPath: xmlPath,
  });

  assert.equal(result.bpm, 76);
  assert.equal(result.genre, "Hip Hop");
  assert.equal(result.key, "A Minor");
  assert.equal(result.trackName, "HUMBLE.");
  assert.equal(result.artist, "Kendrick Lamar");
  assert.equal(result.sources.bpm, "rekordbox_xml");
  assert.equal(result.sources.genre, "rekordbox_xml");
  assert.equal(result.status, "complete");
});

test("track not found in Rekordbox XML", async () => {
  const xmlPath = await writeRekordboxXml(`
    <TRACK Name="Other" Artist="Someone" AverageBpm="120" Genre="House" />
  `);

  const result = await enrichTrackMetadata({
    trackName: "HUMBLE.",
    artist: "Kendrick Lamar",
    rekordboxXmlPath: xmlPath,
  }, nullProviderDependencies);

  assert.equal(result.bpm, null);
  assert.equal(result.genre, null);
  assert.equal(result.status, "missing");
});

test("track found in Rekordbox XML with BPM only", async () => {
  const xmlPath = await writeRekordboxXml(`
    <TRACK Name="HUMBLE." Artist="Kendrick Lamar" AverageBpm="76" />
  `);

  const result = await enrichTrackMetadata({
    trackName: "HUMBLE.",
    artist: "Kendrick Lamar",
    rekordboxXmlPath: xmlPath,
  }, nullProviderDependencies);

  assert.equal(result.bpm, 76);
  assert.equal(result.genre, null);
  assert.equal(result.sources.bpm, "rekordbox_xml");
  assert.equal(result.status, "partial");
});

test("track found in Rekordbox XML with genre only", async () => {
  const xmlPath = await writeRekordboxXml(`
    <TRACK Name="HUMBLE." Artist="Kendrick Lamar" Genre="Hip Hop" />
  `);

  const result = await enrichTrackMetadata({
    trackName: "HUMBLE.",
    artist: "Kendrick Lamar",
    rekordboxXmlPath: xmlPath,
  }, nullProviderDependencies);

  assert.equal(result.bpm, null);
  assert.equal(result.genre, "Hip Hop");
  assert.equal(result.sources.genre, "rekordbox_xml");
  assert.equal(result.status, "partial");
});

test("local DB data wins over Rekordbox XML", async () => {
  const xmlPath = await writeRekordboxXml(`
    <TRACK Name="HUMBLE." Artist="Kendrick Lamar" AverageBpm="120" Genre="House" />
  `);
  const store: EnrichmentResultStore = {
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

  const result = await enrichTrackMetadata({
    trackName: "HUMBLE.",
    artist: "Kendrick Lamar",
    rekordboxXmlPath: xmlPath,
  }, { store });

  assert.equal(result.bpm, 76);
  assert.equal(result.genre, "Hip Hop");
  assert.equal(result.key, "A Minor");
  assert.equal(result.sources.bpm, "local_db");
  assert.equal(result.sources.genre, "local_db");
});

test("external providers are not called when Rekordbox has BPM and genre", async () => {
  const xmlPath = await writeRekordboxXml(`
    <TRACK Name="HUMBLE." Artist="Kendrick Lamar" AverageBpm="76" Genre="Hip Hop" />
  `);
  let calls = 0;

  const result = await enrichTrackMetadata(
    {
      trackName: "HUMBLE.",
      artist: "Kendrick Lamar",
      rekordboxXmlPath: xmlPath,
    },
    {
      spotifyLookup: async () => {
        calls += 1;
        return { bpm: null, genre: "Should not call" };
      },
      getSongBpmLookup: async () => {
        calls += 1;
        return { bpm: 999, genre: "Should not call" };
      },
    },
  );

  assert.equal(calls, 0);
  assert.equal(result.status, "complete");
});

test("provider album is preserved in enriched output", async () => {
  const result = await enrichTrackMetadata(
    { trackName: "HUMBLE.", artist: "Kendrick Lamar" },
    {
      spotifyLookup: async () => ({
        bpm: null,
        genre: "Hip Hop",
        track: {
          title: "HUMBLE.",
          artists: ["Kendrick Lamar"],
          album: "DAMN.",
          spotifyUrl: "https://open.spotify.com/track/demo",
        },
        url: "https://open.spotify.com/track/demo",
      }),
      getSongBpmLookup: async () => ({
        bpm: 76,
        genre: null,
        key: "C#m",
      }),
    },
  );

  assert.equal(result.album, "DAMN.");
  assert.equal(result.sources.album, "spotify");
  assert.equal(result.spotifyUrl, "https://open.spotify.com/track/demo");
  assert.equal(result.trackName, "HUMBLE.");
  assert.equal(result.artist, "Kendrick Lamar");
});

test("output status reflects complete, partial, and missing states", async () => {
  const complete = await enrichTrackMetadata(
    { trackName: "A", artist: "B" },
    {
      spotifyLookup: async () => ({ bpm: null, genre: "House" }),
      getSongBpmLookup: async () => ({ bpm: 120, genre: null }),
    },
  );
  const partial = await enrichTrackMetadata(
    { trackName: "A", artist: "B" },
    {
      spotifyLookup: async () => ({ bpm: null, genre: null }),
      getSongBpmLookup: async () => ({ bpm: 120, genre: null }),
    },
  );
  const missing = await enrichTrackMetadata(
    { trackName: "A", artist: "B" },
    {
      spotifyLookup: async () => ({ bpm: null, genre: null }),
      getSongBpmLookup: async () => ({ bpm: null, genre: null }),
    },
  );

  assert.equal(complete.status, "complete");
  assert.equal(partial.status, "partial");
  assert.equal(missing.status, "missing");
});

async function writeRekordboxXml(trackXml: string) {
  const directory = await mkdtemp(join(tmpdir(), "track-lab-rb-"));
  const xmlPath = join(directory, "rekordbox.xml");

  await writeFile(
    xmlPath,
    `<?xml version="1.0" encoding="UTF-8"?>
    <DJ_PLAYLISTS Version="1.0.0">
      <COLLECTION Entries="1">
        ${trackXml}
      </COLLECTION>
    </DJ_PLAYLISTS>`,
    "utf8",
  );

  return xmlPath;
}

const nullProviderDependencies = {
  spotifyLookup: async () => ({ bpm: null, genre: null }),
  getSongBpmLookup: async () => ({ bpm: null, genre: null }),
};
