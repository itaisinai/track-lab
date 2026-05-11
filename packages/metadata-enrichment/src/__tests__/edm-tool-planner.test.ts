import assert from "node:assert/strict";
import test from "node:test";
import { planEdmTools } from "../planning/edm-tool-planner.ts";
import {
  toPlannerCurrentResultSummary,
  toPlannerProviderEvidenceSummary,
} from "../planning/planner-input.ts";

test("EDM planner runs Beatport and SoundCloud for deterministic EDM signals", async () => {
  const plan = await planEdmTools({
    currentResult: baseResult({
      genre: "Dubstep",
      subGenre: "Bass",
    }),
    currentResultSummary: {
      ...toPlannerCurrentResultSummary(
        baseResult({
          genre: "Dubstep",
          subGenre: "Bass",
        }),
      ),
      matchedProviders: ["spotify"],
    },
    providerEvidenceSummary: toPlannerProviderEvidenceSummary({
      spotify: { title: "DRUGS!", artists: "TVBOO, CHOMPPA", genres: ["Dubstep"] },
    }),
  });

  assert.equal(plan.classification, "edm");
  assert.equal(plan.shouldRunEdmTools, true);
  assert.deepEqual(plan.toolsToRun, ["beatport", "soundcloud"]);
  assert.equal(plan.decidedBy, "deterministic");
});

test("EDM planner skips Beatport and SoundCloud for deterministic non-EDM signals", async () => {
  const plan = await planEdmTools({
    currentResult: baseResult({
      genre: "Hip Hop",
      subGenre: null as string | null,
    }),
    currentResultSummary: toPlannerCurrentResultSummary(
      baseResult({
        genre: "Hip Hop",
        subGenre: null as string | null,
      }),
    ),
    providerEvidenceSummary: toPlannerProviderEvidenceSummary({
      spotify: { title: "HUMBLE.", artists: "Kendrick Lamar" },
    }),
  });

  assert.equal(plan.classification, "not_edm");
  assert.equal(plan.shouldRunEdmTools, false);
  assert.deepEqual(plan.toolsToRun, []);
  assert.equal(plan.decidedBy, "deterministic");
});

test("planner summaries stay compact", () => {
  const currentResultSummary = toPlannerCurrentResultSummary(
    baseResult({
      genre: "Dubstep",
      subGenre: "Bass",
    }),
  );
  const providerEvidenceSummary = toPlannerProviderEvidenceSummary({
    spotify: { title: "DRUGS!", artists: "TVBOO, CHOMPPA", genres: ["Dubstep"] },
    beatport: { title: "DRUGS!", bpm: 71, genre: "Dubstep" },
  });

  assert.equal(currentResultSummary.hasBpm, true);
  assert.equal(currentResultSummary.hasKey, true);
  assert.ok(currentResultSummary.matchedProviders.length > 0);
  assert.ok(providerEvidenceSummary.spotify);
  assert.ok(providerEvidenceSummary.beatport);
  assert.ok(providerEvidenceSummary.spotify?.length < 240);
});

function baseResult(overrides: Partial<ReturnType<typeof makeBaseResult>> = {}) {
  return {
    ...makeBaseResult(),
    ...overrides,
  };
}

function makeBaseResult() {
  return {
    operation: "analyze" as const,
    trackName: "DRUGS!",
    artist: "TVBOO, CHOMPPA",
    album: "DRUGS!",
    spotifyUrl: "https://open.spotify.com/track/3DrLUA0OtmaGZDMq3dR2DH",
    summary: "Bass-heavy Wakaan-style dubstep ideal for peak-time or transitions in a bass-forward club set.",
    bpm: 71,
    genre: "Dubstep",
    subGenre: "Bass" as string | null,
    key: "D Minor",
    sources: {
      trackName: "spotify" as const,
      artist: "spotify" as const,
      album: "spotify" as const,
      bpm: "beatport" as const,
      genre: "beatport" as const,
      key: "beatport" as const,
      subGenre: "soundcloud" as const,
    },
    confidence: {
      album: 0.65,
      bpm: 0.85,
      genre: 0.85,
      key: 0.85,
      subGenre: 0.55,
    },
    toolsUsed: [],
    status: "complete" as const,
  };
}
