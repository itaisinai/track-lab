import type { RemixSearchCandidate } from "@track-lab/api-types";

export type RemixJudgeCandidateInput = {
  index: number;
  title: string;
  artists: string;
  remixArtist: string | null;
  genre: string | null;
  subGenre: string | null;
  provider: string;
  confidence: number;
  deterministicReason: string;
};

export function toRemixJudgeCandidateInput(
  candidate: RemixSearchCandidate,
  index: number,
): RemixJudgeCandidateInput {
  return {
    index,
    title: candidate.title,
    artists: candidate.artists,
    remixArtist: candidate.remixArtist ?? null,
    genre: candidate.genre ?? null,
    subGenre: candidate.subGenre ?? null,
    provider: candidate.provider,
    confidence: candidate.confidence,
    deterministicReason: candidate.relevanceReason,
  };
}
