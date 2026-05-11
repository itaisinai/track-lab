import type { SoundCloudWebSearchResult } from "./web-search.ts";
import { splitArtistNames } from "../shared/track-query.ts";
import { normalize } from "../shared/utils.ts";

const REMIX_MARKER = /\b(remix|bootleg|flip|vip|rework|edit)\b/i;

type ScoredSoundCloudMatch = {
  candidate: SoundCloudWebSearchResult;
  score: number;
};

export type SoundCloudMetadataMatchDebug = {
  candidate: SoundCloudWebSearchResult;
  score: number;
};

export function findBestSoundCloudMetadataMatch(
  candidates: SoundCloudWebSearchResult[],
  title: string,
  artists: string,
) {
  return rankSoundCloudMetadataCandidates(candidates, title, artists)[0]
    ?.candidate ?? null;
}

export function rankSoundCloudMetadataCandidates(
  candidates: SoundCloudWebSearchResult[],
  title: string,
  artists: string,
) {
  const normalizedTitle = normalize(title);
  const requestedArtists = splitArtistNames(artists).map(normalize);
  const scored = candidates
    .map((candidate) =>
      scoreSoundCloudMetadataCandidate(
        candidate,
        normalizedTitle,
        requestedArtists,
      ),
    )
    .filter((match): match is ScoredSoundCloudMatch => Boolean(match))
    .sort((left, right) => right.score - left.score);

  return scored.map((match) => ({
    candidate: match.candidate,
    score: match.score,
  }));
}

export function isSoundCloudRemixCandidate(
  candidate: Pick<SoundCloudWebSearchResult, "title" | "subGenre" | "link">,
) {
  return [candidate.title, candidate.subGenre ?? "", candidate.link]
    .filter(Boolean)
    .some((value) => REMIX_MARKER.test(value));
}

function scoreSoundCloudMetadataCandidate(
  candidate: SoundCloudWebSearchResult,
  normalizedTitle: string,
  requestedArtists: string[],
): ScoredSoundCloudMatch | null {
  if (!candidate.link || isSoundCloudRemixCandidate(candidate)) {
    return null;
  }

  const candidateTitle = normalize(candidate.title);
  const candidateArtists = normalize(candidate.artists);
  const haystack = normalize([candidate.title, candidate.artists].join(" "));
  const titleScore = scoreTitle(candidateTitle, normalizedTitle);
  const artistScore = scoreArtists(haystack, candidateArtists, requestedArtists);

  if (titleScore === 0) {
    return null;
  }

  return {
    candidate,
    score: titleScore + artistScore,
  };
}

function scoreTitle(candidateTitle: string, requestedTitle: string) {
  if (candidateTitle === requestedTitle) {
    return 4;
  }

  if (candidateTitle.includes(requestedTitle)) {
    return 3;
  }

  const requestedWords = requestedTitle.split(/\s+/).filter(Boolean);
  const matchedWords = requestedWords.filter((word) =>
    candidateTitle.includes(word),
  );

  return requestedWords.length > 0 &&
    matchedWords.length === requestedWords.length
    ? 2
    : 0;
}

function scoreArtists(
  haystack: string,
  candidateArtists: string,
  requestedArtists: string[],
) {
  if (requestedArtists.length === 0) {
    return 0;
  }

  const matchedArtists = requestedArtists.filter((artist) =>
    haystack.includes(artist),
  );

  if (matchedArtists.length === 0) {
    return 0;
  }

  const directArtistMatch = requestedArtists.some((artist) =>
    candidateArtists.includes(artist),
  );

  return directArtistMatch ? 2 + matchedArtists.length : 1 + matchedArtists.length;
}
