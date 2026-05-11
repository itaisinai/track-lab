import type { RemixSearchCandidate } from "@track-lab/api-types";
import type { NormalizedRemixSearchRequest } from "../types.ts";
import { rankRemixCandidates, scoreAndDedupeRemixCandidates } from "../scoring.ts";

export const LLM_JUDGE_BATCH_SIZE = 25;
export const MAX_LLM_JUDGE_ATTEMPTS = 2;

export function scoreRemixCandidates(
  candidates: RemixSearchCandidate[],
  request: NormalizedRemixSearchRequest,
) {
  return scoreAndDedupeRemixCandidates(candidates, request);
}

export function selectDeterministicRemixCandidates(
  candidates: RemixSearchCandidate[],
  request: NormalizedRemixSearchRequest,
) {
  return rankRemixCandidates(candidates, request);
}

export function createLlmJudgeCandidateBatches(
  candidates: RemixSearchCandidate[],
) {
  return Array.from({ length: MAX_LLM_JUDGE_ATTEMPTS }, (_, attempt) =>
    candidates.slice(
      attempt * LLM_JUDGE_BATCH_SIZE,
      (attempt + 1) * LLM_JUDGE_BATCH_SIZE,
    ),
  ).filter((batch) => batch.length > 0);
}
