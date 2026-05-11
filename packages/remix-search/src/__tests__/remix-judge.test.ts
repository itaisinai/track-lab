import assert from "node:assert/strict";
import test from "node:test";
import type { RemixSearchCandidate } from "@track-lab/api-types";
import {
  createLlmJudgeCandidateBatches,
  MAX_LLM_JUDGE_ATTEMPTS,
  LLM_JUDGE_BATCH_SIZE,
} from "../selection/remix-candidate-selection.ts";
import { judgeRemixCandidates } from "../judge/remix-candidate-judge.ts";

test("remix judge batches candidates deterministically", () => {
  const candidates = Array.from({ length: LLM_JUDGE_BATCH_SIZE + 1 }, (_, index) =>
    candidate(index),
  );

  const batches = createLlmJudgeCandidateBatches(candidates);

  assert.equal(MAX_LLM_JUDGE_ATTEMPTS, 2);
  assert.equal(batches.length, 2);
  assert.equal(batches[0]?.length, LLM_JUDGE_BATCH_SIZE);
  assert.equal(batches[1]?.length, 1);
});

test("remix judge falls back deterministically without OpenAI when genre is missing", async () => {
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  const previousOpenAiLegacyKey = process.env.OPEN_AI_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPEN_AI_KEY;

  try {
    const result = await judgeRemixCandidates(
      [
        candidate(0, {
          title: "Babatunde (ZEKE BEATS Remix)",
          artists: "Peekaboo & G-Rex",
          genre: "Dubstep",
          subGenre: "Bass",
        }),
        candidate(1, {
          title: "Completely Different Song",
          artists: "Someone Else",
          genre: "Pop",
        }),
      ],
      {
        title: "Babatunde",
        artists: "Peekaboo, G-Rex",
        genre: null,
        spotifyUrl: null,
      },
    );

    assert.equal(result[0]?.title, "Babatunde (ZEKE BEATS Remix)");
  } finally {
    if (previousOpenAiKey) {
      process.env.OPENAI_API_KEY = previousOpenAiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }

    if (previousOpenAiLegacyKey) {
      process.env.OPEN_AI_KEY = previousOpenAiLegacyKey;
    } else {
      delete process.env.OPEN_AI_KEY;
    }
  }
});

test("remix judge returns empty results without OpenAI when genre is required", async () => {
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  const previousOpenAiLegacyKey = process.env.OPEN_AI_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPEN_AI_KEY;

  try {
    const result = await judgeRemixCandidates(
      [
        candidate(0, {
          title: "Babatunde (ZEKE BEATS Remix)",
          artists: "Peekaboo & G-Rex",
          genre: "Dubstep",
          subGenre: "Bass",
        }),
      ],
      {
        title: "Babatunde",
        artists: "Peekaboo, G-Rex",
        genre: "bass",
        spotifyUrl: null,
      },
    );

    assert.equal(result.length, 0);
  } finally {
    if (previousOpenAiKey) {
      process.env.OPENAI_API_KEY = previousOpenAiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }

    if (previousOpenAiLegacyKey) {
      process.env.OPEN_AI_KEY = previousOpenAiLegacyKey;
    } else {
      delete process.env.OPEN_AI_KEY;
    }
  }
});

function candidate(
  index: number,
  overrides: Partial<RemixSearchCandidate> = {},
): RemixSearchCandidate {
  return {
    title: `Candidate ${index}`,
    artists: "Artist",
    remixArtist: null,
    album: null,
    genre: null,
    subGenre: null,
    bpm: null,
    provider: "SoundCloud",
    link: `https://soundcloud.com/test/${index}`,
    createdAt: "2019-01-01T00:00:00Z",
    durationMs: 180000,
    confidence: 0,
    relevanceReason: "",
    ...overrides,
  };
}
