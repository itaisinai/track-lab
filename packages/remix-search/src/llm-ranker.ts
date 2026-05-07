import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import type { RemixSearchCandidate } from "@track-lab/api-types";
import { logRemixSearch } from "@track-lab/logger";
import {
  rankRemixCandidates,
  scoreAndDedupeRemixCandidates,
} from "./scoring.ts";
import type { NormalizedRemixSearchRequest } from "./types.ts";

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

const remixRankerModel = new ChatOpenAI({
  model: "gpt-5-nano",
  apiKey: process.env.OPENAI_API_KEY ?? process.env.OPEN_AI_KEY,
});

export async function rankAndFilterRemixCandidates(
  candidates: RemixSearchCandidate[],
  request: NormalizedRemixSearchRequest,
): Promise<RemixSearchCandidate[]> {
  const scoredCandidates = scoreAndDedupeRemixCandidates(candidates, request);
  const deterministicCandidates = rankRemixCandidates(candidates, request);

  if (!process.env.OPENAI_API_KEY && !process.env.OPEN_AI_KEY) {
    logRemixSearch("llm ranking skipped missing OpenAI key", {
      scoredCandidates: scoredCandidates.length,
      requestedGenre: request.genre,
    });
    return request.genre ? [] : deterministicCandidates;
  }

  if (scoredCandidates.length === 0) {
    return [];
  }

  try {
    logRemixSearch("llm ranking started", {
      candidates: scoredCandidates.length,
      deterministicCandidates: deterministicCandidates.length,
      genre: request.genre,
      topDeterministicCandidates: deterministicCandidates
        .slice(0, 5)
        .map((candidate) => ({
          title: candidate.title,
          artists: candidate.artists,
          provider: candidate.provider,
          confidence: candidate.confidence,
        })),
    });
    const candidateInput = scoredCandidates
      .slice(0, 50)
      .map((candidate, index) => ({
        index,
        title: candidate.title,
        artists: candidate.artists,
        remixArtist: candidate.remixArtist,
        album: candidate.album,
        genre: candidate.genre,
        subGenre: candidate.subGenre,
        provider: candidate.provider,
        link: candidate.link,
        createdAt: candidate.createdAt,
        deterministicConfidence: candidate.confidence,
        deterministicReason: candidate.relevanceReason,
      }));
    const response = await remixRankerModel.invoke([
      new SystemMessage(`You filter and rank remix search candidates.
Return only strict JSON.
Accept only candidates that are likely remixes, edits, flips, bootlegs, VIPs, reworks, or unofficial remixes of the requested original track.
The candidate must match the requested title and at least one requested original artist or a well-known remix naming pattern that clearly points to the requested original.
Tolerate minor spelling differences, transliteration, punctuation differences, and common typos in the requested title. For example, "Gimmi" can match "Gimme" when the artist and remix context also fit.
If requestedGenre is provided, it is a hard requirement. Keep only tracks whose metadata, title, artist context, tags, snippet, or known producer style are compatible with that genre. Treat genre broadly enough for DJ usage, but require real evidence. For example, "bass" can include dubstep, trap, riddim, future bass, freeform bass, UK bass, drum and bass, or bass music, but generic "Dance & EDM", "Club Remix", "Disco", or "House" alone is not enough evidence for bass.
Reject unrelated tracks, unrelated artists, playlists, generic search pages, and tracks that only weakly share one word.
Do not invent URLs or candidates. Use only the provided indexes.
Return confidence with meaningful spread, not the copied deterministic score.
Use remixFit for how clearly this is a remix/edit/flip of the requested track.
Use genreFit for how strongly the candidate matches requestedGenre. If no requestedGenre was provided, genreFit should reflect broad DJ usefulness and metadata quality.
For requestedGenre "bass", examples:
- 95-100 genreFit: explicit bass subgenre evidence such as drum & bass, future bass, bass house, deep bass, dubstep, trap, UK bass, bass music, or strong bass tags.
- 80-90 genreFit: title says bass boosted/deep bass/bass remix but genre metadata is broader.
- 60-75 genreFit: indirect or weak bass evidence.
- reject: generic Dance & EDM, Club Remix, Disco, or House with no bass evidence.
Confidence should combine remixFit, genreFit, original-title match, and source quality.`),
      new HumanMessage(
        JSON.stringify({
          requestedTrack: {
            title: request.title,
            artists: request.artists,
            requestedGenre: request.genre,
          },
          candidates: candidateInput,
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
    const ranked = getRankedCandidates(parsed?.candidates, scoredCandidates);

    if (
      ranked.length === 0 &&
      deterministicCandidates.length > 0 &&
      !request.genre
    ) {
      logRemixSearch(
        "llm ranking returned no candidates, using deterministic fallback",
        {
          deterministicCandidates: deterministicCandidates.length,
          topDeterministicCandidates: deterministicCandidates
            .slice(0, 5)
            .map((candidate) => ({
              title: candidate.title,
              artists: candidate.artists,
              provider: candidate.provider,
              confidence: candidate.confidence,
            })),
        },
      );
      return deterministicCandidates;
    }

    if (
      ranked.length === 0 &&
      deterministicCandidates.length > 0 &&
      request.genre
    ) {
      logRemixSearch(
        "llm genre filtering returned no candidates, keeping empty result",
        {
          requestedGenre: request.genre,
          deterministicCandidates: deterministicCandidates.length,
        },
      );
    }

    logRemixSearch("llm ranking completed", {
      returnedCandidates: ranked.length,
      topCandidates: ranked.slice(0, 5).map((candidate) => ({
        title: candidate.title,
        artists: candidate.artists,
        provider: candidate.provider,
        confidence: candidate.confidence,
      })),
    });

    return ranked;
  } catch (error) {
    logRemixSearch("llm ranking failed", {
      error: error instanceof Error ? error.message : String(error),
      fallback:
        request.genre
          ? "empty result because requested genre requires LLM filtering"
          : "deterministic ranker",
    });
    return request.genre ? [] : deterministicCandidates;
  }
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

  return Math.round(remixFit * 0.55 + genreFit * 0.45);
}

function getScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : null;
}

function isRemixSearchCandidate(
  value: RemixSearchCandidate | null,
): value is RemixSearchCandidate {
  return value !== null;
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
    const objectText = candidate.match(/\{[\s\S]*\}/)?.[0];

    if (!objectText) {
      return null;
    }

    try {
      const parsed = JSON.parse(objectText);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}

function getNullableString(value: unknown) {
  if (value === null) {
    return null;
  }

  return typeof value === "string" && value.trim() ? value.trim() : null;
}
