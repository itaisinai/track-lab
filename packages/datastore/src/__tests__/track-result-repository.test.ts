import assert from "node:assert/strict";
import test from "node:test";

import { PrismaTrackResultRepository } from "../prisma-track-result-repository.ts";
import {
  createTrackResultRepository,
  type TrackResultRepositoryFactoryOptions,
} from "../track-result-repository-factory.ts";
import { TrackResultStore } from "../track-result-store.ts";

test("track result repository factory defaults to sqlite", () => {
  const previousProvider = process.env.DATASTORE_PROVIDER;
  delete process.env.DATASTORE_PROVIDER;

  try {
    const repository = createTrackResultRepository();

    assert.ok(repository instanceof TrackResultStore);
  } finally {
    if (previousProvider) {
      process.env.DATASTORE_PROVIDER = previousProvider;
    } else {
      delete process.env.DATASTORE_PROVIDER;
    }
  }
});

test("track result repository factory selects prisma when configured", () => {
  const previousProvider = process.env.DATASTORE_PROVIDER;
  process.env.DATASTORE_PROVIDER = "prisma";

  try {
    const repository = createTrackResultRepository({
      prismaClient: {
        trackResult: {
          findMany: async () => [],
          findUnique: async () => null,
          deleteMany: async () => ({ count: 0 }),
          upsert: async () => ({
            id: 1,
            title: "Test",
            artists: "Artist",
            album: null,
            titleKey: "test",
            artistsKey: "artist",
            bpm: null,
            genre: null,
            subGenre: null,
            trackKey: null,
            summary: null,
            status: "partial",
            providersUsedJson: "[]",
            errorsJson: "[]",
            responseJson: "{}",
            rawResponse: "{}",
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      } as TrackResultRepositoryFactoryOptions["prismaClient"],
    });

    assert.ok(repository instanceof PrismaTrackResultRepository);
  } finally {
    if (previousProvider) {
      process.env.DATASTORE_PROVIDER = previousProvider;
    } else {
      delete process.env.DATASTORE_PROVIDER;
    }
  }
});

test("prisma track result repository maps rows and queries by normalized track keys", async () => {
  const calls: Record<string, unknown> = {};
  const row = {
    id: 42,
    title: "Strobe",
    artists: "deadmau5",
    album: "For Lack of a Better Name",
    titleKey: "strobe",
    artistsKey: "deadmau5",
    bpm: 128,
    genre: "Progressive House",
    subGenre: "Progressive House",
    trackKey: "F#m",
    summary: "A long-form progressive house classic.",
    status: "complete" as const,
    providersUsedJson: JSON.stringify([
      { name: "Spotify", matched: true, url: "https://open.spotify.com/track/1", error: null },
    ]),
    errorsJson: "[]",
    responseJson: JSON.stringify({ title: "Strobe" }),
    rawResponse: "{}",
    createdAt: new Date("2026-05-17T10:00:00.000Z"),
    updatedAt: new Date("2026-05-17T10:15:00.000Z"),
  };

  const repository = new PrismaTrackResultRepository({
    trackResult: {
      findMany: async (args) => {
        calls.findMany = args;
        return [row];
      },
      findUnique: async (args) => {
        calls.findUnique = args;
        return row;
      },
      deleteMany: async (args) => {
        calls.deleteMany = args;
        return { count: 1 };
      },
      upsert: async (args) => {
        calls.upsert = args;
        return row;
      },
    },
  });

  const listed = await repository.listResults();
  assert.deepEqual(calls.findMany, {
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });
  assert.equal(listed[0]?.createdAt, "2026-05-17T10:00:00.000Z");
  assert.equal(listed[0]?.updatedAt, "2026-05-17T10:15:00.000Z");
  assert.deepEqual(listed[0]?.providersUsed, [
    {
      name: "Spotify",
      matched: true,
      url: "https://open.spotify.com/track/1",
      error: null,
    },
  ]);

  const found = await repository.findByTrack("Strobe", "deadmau5");
  assert.deepEqual(calls.findUnique, {
    where: {
      titleKey_artistsKey: {
        titleKey: "strobe",
        artistsKey: "deadmau5",
      },
    },
  });
  assert.equal(found?.key, "F#m");

  assert.equal(await repository.deleteResult(42), true);
  assert.deepEqual(calls.deleteMany, { where: { id: 42 } });

  const saved = await repository.saveResult({
    rawResponse: "{}",
    json: {
      title: "Strobe",
      artists: "deadmau5",
      album: "For Lack of a Better Name",
      bpm: 128,
      genre: "Progressive House",
      subGenre: "Progressive House",
      key: "F#m",
      summary: "A long-form progressive house classic.",
      providersUsed: [
        {
          name: "Spotify",
          matched: true,
          url: "https://open.spotify.com/track/1",
          error: null,
        },
      ],
      errors: [],
      status: "complete",
    },
  });
  assert.deepEqual(calls.upsert, {
    where: {
      titleKey_artistsKey: {
        titleKey: "strobe",
        artistsKey: "deadmau5",
      },
    },
    create: {
      title: "Strobe",
      artists: "deadmau5",
      album: "For Lack of a Better Name",
      titleKey: "strobe",
      artistsKey: "deadmau5",
      bpm: 128,
      genre: "Progressive House",
      subGenre: "Progressive House",
      trackKey: "F#m",
      summary: "A long-form progressive house classic.",
      status: "complete",
      providersUsedJson: JSON.stringify([
        {
          name: "Spotify",
          matched: true,
          url: "https://open.spotify.com/track/1",
          error: null,
        },
      ]),
      errorsJson: "[]",
      responseJson: JSON.stringify({
        title: "Strobe",
        artists: "deadmau5",
        album: "For Lack of a Better Name",
        bpm: 128,
        genre: "Progressive House",
        subGenre: "Progressive House",
        key: "F#m",
        summary: "A long-form progressive house classic.",
        providersUsed: [
          {
            name: "Spotify",
            matched: true,
            url: "https://open.spotify.com/track/1",
            error: null,
          },
        ],
        errors: [],
        status: "complete",
      }),
      rawResponse: "{}",
    },
    update: {
      title: "Strobe",
      artists: "deadmau5",
      album: "For Lack of a Better Name",
      titleKey: "strobe",
      artistsKey: "deadmau5",
      bpm: 128,
      genre: "Progressive House",
      subGenre: "Progressive House",
      trackKey: "F#m",
      summary: "A long-form progressive house classic.",
      status: "complete",
      providersUsedJson: JSON.stringify([
        {
          name: "Spotify",
          matched: true,
          url: "https://open.spotify.com/track/1",
          error: null,
        },
      ]),
      errorsJson: "[]",
      responseJson: JSON.stringify({
        title: "Strobe",
        artists: "deadmau5",
        album: "For Lack of a Better Name",
        bpm: 128,
        genre: "Progressive House",
        subGenre: "Progressive House",
        key: "F#m",
        summary: "A long-form progressive house classic.",
        providersUsed: [
          {
            name: "Spotify",
            matched: true,
            url: "https://open.spotify.com/track/1",
            error: null,
          },
        ],
        errors: [],
        status: "complete",
      }),
      rawResponse: "{}",
    },
  });
  assert.equal(saved.id, 42);
});
