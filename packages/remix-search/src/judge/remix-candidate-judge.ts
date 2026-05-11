import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import type { RemixSearchCandidate } from "@track-lab/api-types";
import { logRemixSearch } from "@track-lab/logger";
import type { NormalizedRemixSearchRequest } from "../types.ts";
import { selectDeterministicRemixCandidates, scoreRemixCandidates } from "../selection/remix-candidate-selection.ts";
import {
  MAX_LLM_JUDGE_ATTEMPTS,
  createLlmJudgeCandidateBatches,
} from "../selection/remix-candidate-selection.ts";
import { toRemixJudgeCandidateInput } from "./remix-judge-input.ts";

type LlmRankedCandidate = {
  index?: unknown;
  confidence?: unknown;
  remixFit?: unknown;
  genreFit?: unknown;
  remixArtist?: unknown;
  genre?: unknown;
  subGenre?: unknown;
  relevanceReason?: unknown;
};

const remixJudgeModel = new ChatOpenAI({
  model: "gpt-5-nano",
  apiKey: process.env.OPENAI_API_KEY ?? process.env.OPEN_AI_KEY,
});

export async function judgeRemixCandidates(
  candidates: RemixSearchCandidate[],
  request: NormalizedRemixSearchRequest,
): Promise<RemixSearchCandidate[]> {
  const scoredCandidates = scoreRemixCandidates(candidates, request);
  const deterministicCandidates = selectDeterministicRemixCandidates(
    candidates,
    request,
  );

  if (!process.env.OPENAI_API_KEY && !process.env.OPEN_AI_KEY) {
    logRemixSearch("llm judge skipped missing OpenAI key", {
      scoredCandidates: scoredCandidates.length,
      requestedGenre: request.genre,
    });
    return request.genre ? [] : deterministicCandidates;
  }

  if (scoredCandidates.length === 0) {
    return [];
  }

  const batches = createLlmJudgeCandidateBatches(scoredCandidates);

  logRemixSearch("llm judge started", {
    candidates: scoredCandidates.length,
    batches: batches.length,
    requestedGenre: request.genre,
    topDeterministicCandidates: deterministicCandidates
      .slice(0, 5)
      .map((candidate) => ({
        title: candidate.title,
        artists: candidate.artists,
        provider: candidate.provider,
        confidence: candidate.confidence,
      })),
  });

  for (let batchIndex = 0; batchIndex < Math.min(batches.length, MAX_LLM_JUDGE_ATTEMPTS); batchIndex += 1) {
    const batch = batches[batchIndex] ?? [];
    const judged = await judgeCandidateBatch(batch, request, batchIndex);

    if (judged.length > 0) {
      logRemixSearch("llm judge completed", {
        batchIndex,
        returnedCandidates: judged.length,
        topCandidates: judged.slice(0, 5).map((candidate) => ({
          title: candidate.title,
          artists: candidate.artists,
          provider: candidate.provider,
          confidence: candidate.confidence,
        })),
      });

      return judged;
    }
  }

  if (!request.genre) {
    logRemixSearch("llm judge returned no candidates, using deterministic fallback", {
      deterministicCandidates: deterministicCandidates.length,
    });
    return deterministicCandidates;
  }

  logRemixSearch("llm judge returned no candidates for requested genre", {
    requestedGenre: request.genre,
    deterministicCandidates: deterministicCandidates.length,
  });

  return [];
}

async function judgeCandidateBatch(
  batch: RemixSearchCandidate[],
  request: NormalizedRemixSearchRequest,
  batchIndex: number,
) {
  if (batch.length === 0) {
    return [];
  }

  const response = await remixJudgeModel.invoke([
    new SystemMessage(`You filter and rank remix search candidates.
Return only strict JSON.
Accept only candidates that are likely remixes, edits, flips, bootlegs, VIPs, reworks, or unofficial remixes of the requested original track.
The candidate must match the requested title and at least one requested original artist or a well-known remix naming pattern that clearly points to the requested original.
Do not invent URLs or candidates. Use only the provided indexes.
Return confidence with meaningful spread, not the copied deterministic score.
Use remixFit for how clearly this is a remix/edit/flip of the requested track.
Use genreFit for how strongly the candidate matches requestedGenre. If no requestedGenre was provided, genreFit should reflect broad DJ usefulness and metadata quality.
Return only indexes from the provided batch.`),
    new HumanMessage(
      JSON.stringify({
        requestedTrack: {
          title: request.title,
          artists: request.artists,
          requestedGenre: request.genre,
          batchIndex,
        },
        candidates: batch.map((candidate, index) =>
          toRemixJudgeCandidateInput(candidate, index),
        ),
        requiredShape: {
          candidates: [
            {
              index: "number from provided candidates",
              confidence: "number 0-100",
              remixFit: "number 0-100",
              genreFit: "number 0-100",
              remixArtist: "string | null",
              genre: "string | null",
              subGenre: "string | null",
              relevanceReason: "short user-facing reason",
            },
          ],
        },
      }),
    ),
  ]);
  const parsed = parseJsonObject(getMessageContent(response));
  const ranked = getRankedCandidates(parsed?.candidates, batch);

  return ranked;
}

function getRankedCandidates(
  value: unknown,
  candidates: RemixSearchCandidate[],
): RemixSearchCandidate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => mapRankedCandidate(item, candidates))
    .filter(isRemixSearchCandidate)
    .filter((candidate) => candidate.confidence >= 50)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 25);
}

function mapRankedCandidate(
  value: unknown,
  candidates: RemixSearchCandidate[],
): RemixSearchCandidate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const ranked = value as LlmRankedCandidate;
  const index = typeof ranked.index === "number" ? ranked.index : null;

  if (index === null || !Number.isInteger(index)) {
    return null;
  }

  const candidate = candidates[index];

  if (!candidate) {
    return null;
  }
  const confidence =
    typeof ranked.confidence === "number" && Number.isFinite(ranked.confidence)
      ? normalizeLlmConfidence(ranked, ranked.confidence)
      : getFallbackLlmConfidence(ranked, candidate);

  return {
    ...candidate,
    remixArtist: getNullableString(ranked.remixArtist) ?? candidate.remixArtist,
    genre: getNullableString(ranked.genre) ?? candidate.genre,
    subGenre: getNullableString(ranked.subGenre) ?? candidate.subGenre,
    confidence,
    relevanceReason:
      getNullableString(ranked.relevanceReason) ?? candidate.relevanceReason,
  };
}

function normalizeLlmConfidence(
  ranked: LlmRankedCandidate,
  confidence: number,
) {
  const remixFit = getScore(ranked.remixFit);
  const genreFit = getScore(ranked.genreFit);
  const boundedConfidence = Math.max(0, Math.min(100, confidence));

  if (remixFit === null || genreFit === null) {
    return Math.round(boundedConfidence);
  }

  return Math.round(
    boundedConfidence * 0.45 + remixFit * 0.3 + genreFit * 0.25,
  );
}

function getFallbackLlmConfidence(
  ranked: LlmRankedCandidate,
  candidate: RemixSearchCandidate,
) {
  const remixFit = getScore(ranked.remixFit);
  const genreFit = getScore(ranked.genreFit);

  if (remixFit === null || genreFit === null) {
    return candidate.confidence;
  }

  return Math.round(candidate.confidence * 0.4 + remixFit * 0.35 + genreFit * 0.25);
}

function isRemixSearchCandidate(
  candidate: RemixSearchCandidate | null,
): candidate is RemixSearchCandidate {
  return Boolean(candidate && candidate.link && candidate.confidence >= 0);
}

function getScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : null;
}

function getNullableString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getMessageContent(message: unknown) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return null;
  }

  const content = (message as Record<string, unknown>).content;
  return typeof content === "string" ? content : null;
}

function parseJsonObject(value: string | null) {
  if (!value) {
    return null;
  }

  const fencedJson = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fencedJson ?? value;

  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
