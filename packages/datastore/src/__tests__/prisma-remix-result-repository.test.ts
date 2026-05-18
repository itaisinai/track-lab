import assert from "node:assert/strict";
import test from "node:test";
import { PrismaRemixResultRepository } from "../prisma-remix-result-repository.ts";

test("prisma remix result repository saves and lists remixes", async () => {
  const state: Array<Record<string, unknown>> = [];
  let lastUpsert: Record<string, unknown> | null = null;

  const repository = new PrismaRemixResultRepository({
    client: {
      remixResult: {
        findMany: async () => state as never,
        upsert: async (args: Record<string, unknown>) => {
          lastUpsert = args;
          const candidate = args.create as Record<string, unknown>;
          const row = {
            id: 7,
            provider: candidate.provider,
            link: candidate.link,
            title: candidate.title,
            artists: candidate.artists,
            remixArtist: candidate.remixArtist ?? null,
            album: candidate.album ?? null,
            genre: candidate.genre ?? null,
            subGenre: candidate.subGenre ?? null,
            bpm: candidate.bpm ?? null,
            uploadedAt: candidate.uploadedAt ?? null,
            durationMs: candidate.durationMs ?? null,
            confidence: candidate.confidence,
            relevanceReason: candidate.relevanceReason,
            originalTrackJson: candidate.originalTrackJson,
            requestedGenre: candidate.requestedGenre ?? null,
            candidateJson: candidate.candidateJson,
            savedAt: new Date("2026-05-18T10:00:00.000Z"),
            updatedAt: new Date("2026-05-18T10:05:00.000Z"),
          };

          state.splice(0, state.length, row);
          return row as never;
        },
      },
    } as never,
  });

  const saved = await repository.saveRemix({
    originalTrack: {
      title: "Strobe",
      artists: "deadmau5",
      spotifyUrl: null,
    },
    requestedGenre: "bass",
    candidate: {
      title: "Strobe (Bass Flip)",
      artists: "DJ Test",
      remixArtist: "DJ Test",
      album: null,
      genre: "Bass",
      subGenre: "dubstep",
      bpm: null,
      provider: "SoundCloud",
      link: "https://soundcloud.com/test/strobe-bass-flip",
      createdAt: "2026-05-18T09:59:00.000Z",
      durationMs: 180000,
      confidence: 91,
      relevanceReason: "explicit bass remix naming",
    },
  });

  assert.equal(saved.id, 7);
  assert.equal(saved.requestedGenre, "bass");
  assert.equal(saved.createdAt, "2026-05-18T09:59:00.000Z");
  assert.deepEqual(((lastUpsert as unknown) as { where?: unknown })?.where, {
    provider_link: {
      provider: "SoundCloud",
      link: "https://soundcloud.com/test/strobe-bass-flip",
    },
  });

  const listed = await repository.listRemixes();
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.title, "Strobe (Bass Flip)");
  assert.equal(listed[0]?.provider, "SoundCloud");
});
