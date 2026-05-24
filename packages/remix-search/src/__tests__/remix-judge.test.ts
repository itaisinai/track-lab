import assert from "node:assert/strict";
import test from "node:test";
import type { RemixSearchCandidate } from "@track-lab/api-types";
import {
  createLlmJudgeCandidateBatches,
  MAX_LLM_JUDGE_ATTEMPTS,
  LLM_JUDGE_BATCH_SIZE,
  scoreRemixCandidates,
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
  delete process.env.OPENAI_API_KEY;

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
  }
});

test("remix judge returns empty results without OpenAI when genre is required", async () => {
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

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
  }
});

test("remix judge input excludes same-title candidates without original artist evidence", () => {
  const scored = scoreRemixCandidates(
    [
      candidate(0, {
        title: "Kumarion - Want It (Chaotic Good Flip)",
        artists: "Chaotic Good",
      }),
      candidate(1, {
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

  assert.equal(scored.length, 1);
  assert.equal(scored[0]?.title, "PEEKABOO - Want It (House Edit)");
});

test("remix judge input excludes originals without remix evidence", () => {
  const scored = scoreRemixCandidates(
    [
      candidate(0, {
        title: "Want It",
        artists: "PEEKABOO",
      }),
      candidate(1, {
        title: "Want It",
        artists: "PEEKABOO, borne",
      }),
      candidate(2, {
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

  assert.equal(scored.length, 1);
  assert.equal(scored[0]?.title, "PEEKABOO - Want It (House Edit)");
});

test("remix judge input keeps genre decisions for the llm", () => {
  const scored = scoreRemixCandidates(
    [
      candidate(0, {
        title: "Black Eyed Peas - Pump It (House Remix)",
        artists: "Black Eyed Peas",
        genre: "House",
      }),
      candidate(1, {
        title: "Black Eyed Peas - Pump It (DNB Bootleg)",
        artists: "Black Eyed Peas",
        genre: "Drum & Bass",
      }),
      candidate(2, {
        title: "Black Eyed Peas - Pump It (Liam V Remix)",
        artists: "Black Eyed Peas",
        genre: "146bpm",
      }),
    ],
    {
      title: "Pump It",
      artists: "Black Eyed Peas",
      genre: "bass",
      spotifyUrl: null,
    },
  );

  assert.deepEqual(
    scored.map((candidate) => candidate.title).sort(),
    [
      "Black Eyed Peas - Pump It (DNB Bootleg)",
      "Black Eyed Peas - Pump It (House Remix)",
      "Black Eyed Peas - Pump It (Liam V Remix)",
    ],
  );
  assert.equal(
    scored.find((candidate) => candidate.title.includes("House"))?.genre,
    "House",
  );
  assert.equal(
    scored.find((candidate) => candidate.title.includes("Liam V"))?.genre,
    "146bpm",
  );
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
