import type { NormalizedRemixSearchRequest } from "./types.ts";
import type { RemixSearchCandidate } from "@track-lab/api-types";

const REMIX_TERMS = ["remix", "edit", "flip", "bootleg", "vip", "rework"];

export function rankRemixCandidates(
  candidates: RemixSearchCandidate[],
  request: NormalizedRemixSearchRequest,
) {
  return scoreAndDedupeRemixCandidates(candidates, request)
    .filter((candidate) => candidate.confidence >= 35)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 25);
}

export function scoreAndDedupeRemixCandidates(
  candidates: RemixSearchCandidate[],
  request: NormalizedRemixSearchRequest,
) {
  const seen = new Set<string>();

  return candidates
    .map((candidate) => scoreCandidate(candidate, request))
    .filter((candidate) => {
      const key = `${candidate.provider}:${normalize(candidate.link || candidate.title)}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) => right.confidence - left.confidence);
}

function scoreCandidate(
  candidate: RemixSearchCandidate,
  request: NormalizedRemixSearchRequest,
): RemixSearchCandidate {
  const haystack = buildCandidateHaystack(candidate);
  const title = normalize(request.title);
  const artistTokens = request.artists
    .split(",")
    .map(normalize)
    .filter(Boolean);
  const genre = normalize(request.genre ?? "");
  const reasons = buildCandidateRelevanceReasons(candidate, title, artistTokens, genre, haystack);
  let score = 0;

  if (hasTitleEvidence(title, haystack)) {
    score += 35;
  } else if (hasCloseTitleEvidence(title, haystack)) {
    score += 24;
  }

  if (hasArtistEvidence(artistTokens, haystack)) {
    score += 20;
  }

  if (hasRemixTerminology(haystack)) {
    score += 18;
  }

  if (hasRequestedGenreEvidence(genre, haystack)) {
    score += 18;
  }

  if (candidate.createdAt) {
    score += 3;
  }

  if (!hasTitleEvidence(title, haystack) && !hasCloseTitleEvidence(title, haystack)) {
    score = Math.min(score, 30);
  }

  return {
    ...candidate,
    confidence: Math.min(100, Math.round(score)),
    relevanceReason: reasons.length
      ? reasons.join(", ")
      : "Weak metadata match; review manually.",
  };
}

export function extractRemixArtist(title: string) {
  const parenthetical = title.match(/\(([^)]*?(?:remix|edit|flip|bootleg|vip|rework)[^)]*)\)/i)?.[1];

  if (!parenthetical) {
    return null;
  }

  return parenthetical
    .replace(/\b(remix|edit|flip|bootleg|vip|rework)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || null;
}

function wordOverlap(left: string, right: string) {
  const leftWords = new Set(left.split(" ").filter(Boolean));
  const rightWords = right.split(" ").filter(Boolean);

  if (!leftWords.size) {
    return 0;
  }

  let matches = 0;
  for (const word of leftWords) {
    if (rightWords.some((rightWord) => wordsMatch(word, rightWord))) {
      matches += 1;
    }
  }

  return matches / leftWords.size;
}

function buildCandidateHaystack(candidate: RemixSearchCandidate) {
  return normalize(
    [
      candidate.title,
      candidate.artists,
      candidate.remixArtist,
      candidate.genre,
      candidate.subGenre,
    ].join(" "),
  );
}

function hasTitleEvidence(title: string, haystack: string) {
  return Boolean(title && haystack.includes(title));
}

function hasCloseTitleEvidence(title: string, haystack: string) {
  return Boolean(title && wordOverlap(title, haystack) >= 0.7);
}

function hasArtistEvidence(artistTokens: string[], haystack: string) {
  return artistTokens.some((artist) => artist && haystack.includes(artist));
}

function hasRemixTerminology(haystack: string) {
  return REMIX_TERMS.some((term) => haystack.includes(term));
}

function hasRequestedGenreEvidence(genre: string, haystack: string) {
  return Boolean(genre && haystack.includes(genre));
}

function buildCandidateRelevanceReasons(
  candidate: RemixSearchCandidate,
  title: string,
  artistTokens: string[],
  genre: string,
  haystack: string,
) {
  const reasons: string[] = [];

  if (hasTitleEvidence(title, haystack)) {
    reasons.push("title match");
  } else if (hasCloseTitleEvidence(title, haystack)) {
    reasons.push("close title match");
  }

  if (hasArtistEvidence(artistTokens, haystack)) {
    reasons.push("original artist match");
  }

  if (hasRemixTerminology(haystack)) {
    reasons.push("remix/edit terminology");
  }

  if (hasRequestedGenreEvidence(genre, haystack)) {
    reasons.push("requested genre text match");
  }

  if (candidate.createdAt) {
    reasons.push("creation date available");
  }

  if (!hasTitleEvidence(title, haystack) && !hasCloseTitleEvidence(title, haystack)) {
    reasons.push("missing title evidence");
  }

  return reasons;
}

function wordsMatch(left: string, right: string) {
  return (
    right.includes(left) ||
    left.includes(right) ||
    (left.length >= 4 && right.length >= 4 && levenshteinDistance(left, right) <= 1)
  );
}

function levenshteinDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length] ?? 0;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
