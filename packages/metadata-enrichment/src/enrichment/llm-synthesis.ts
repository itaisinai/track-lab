import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { getEnrichmentStatus } from "./enrichment-status.ts";
import type { EnrichedTrackMetadata } from "./types.ts";

export type ProviderEvidence = {
  spotify?: unknown;
  beatport?: unknown;
  getSongBpm?: unknown;
  soundcloud?: unknown;
  wikipedia?: unknown;
};

type SynthesisInput = {
  baseResult: EnrichedTrackMetadata;
  providerEvidence: ProviderEvidence;
};

export type BeatportSearchDecision = {
  shouldSearch: boolean;
  classification: "edm" | "unknown" | "not_edm";
  reason?: string;
};

type BeatportSearchDecisionInput = {
  baseResult: EnrichedTrackMetadata;
  providerEvidence: ProviderEvidence;
};

const synthesisModel = new ChatOpenAI({
  model: "gpt-5-nano",
  apiKey: process.env.OPENAI_API_KEY ?? process.env.OPEN_AI_KEY,
});

export async function decideBeatportSearch({
  baseResult,
  providerEvidence,
}: BeatportSearchDecisionInput): Promise<BeatportSearchDecision> {
  if (!process.env.OPENAI_API_KEY && !process.env.OPEN_AI_KEY) {
    return {
      shouldSearch: !baseResult.genre,
      classification: baseResult.genre ? "not_edm" : "unknown",
      reason: "No OpenAI API key configured for Beatport classification.",
    };
  }

  try {
    const response = await synthesisModel.invoke([
      new SystemMessage(`Classify whether Beatport should be searched for this track.
Beatport should be searched only when the track is likely relevant to EDM/DJ catalog music, or when the evidence is too unknown to classify.
Return only strict JSON.
Use "edm" for electronic dance, house, techno, trance, dubstep, drum and bass, bass music, garage, breakbeat, dance remixes, DJ edits, and adjacent club music.
Use "not_edm" for clearly non-EDM pop, hip hop, rock, acoustic, singer-songwriter, or local mainstream music when providers already identified the track.
Use "unknown" when provider evidence is too weak or conflicting to decide.
Do not call something EDM only because it has BPM/key metadata.`),
      new HumanMessage(
        JSON.stringify({
          currentResult: baseResult,
          providerEvidence,
          requiredShape: {
            classification: "edm | unknown | not_edm",
            shouldSearch: "boolean",
            reason: "short string",
          },
        }),
      ),
    ]);
    const parsed = parseJsonObject(getMessageContent(response));
    const classification = getBeatportClassification(parsed?.classification);

    return {
      classification,
      shouldSearch:
        typeof parsed?.shouldSearch === "boolean"
          ? parsed.shouldSearch
          : classification !== "not_edm",
      reason: getString(parsed?.reason) ?? undefined,
    };
  } catch (error) {
    return {
      shouldSearch: false,
      classification: "not_edm",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function synthesizeEnrichedTrackMetadata({
  baseResult,
  providerEvidence,
}: SynthesisInput): Promise<EnrichedTrackMetadata> {
  if (!process.env.OPENAI_API_KEY && !process.env.OPEN_AI_KEY) {
    return addFallbackReviewNotes(baseResult);
  }

  try {
    const response = await synthesisModel.invoke([
      new SystemMessage(`You refine music track metadata from provider evidence.
Return only strict JSON. Do not invent BPM, key, album, URLs, or provider matches.
You may normalize genre/subGenre, write concise review notes, and identify conflicts.
Genre and subGenre are for DJ library tagging, not broad catalog taxonomy.
Avoid generic genre values such as electronic, dance, pop, or edm when track/artist evidence supports a more specific style.
If your summary infers a specific scene or energy such as bass-heavy, dubstep, trap, techno, house, afro house, melodic house, drum and bass, hip hop, or similar, keep the structured genre/subGenre consistent with that same inference.
For example, a bass-heavy Excision track should not be tagged only as electronic; use dubstep, bass, or heavy bass when supported by the evidence.
The summary must include one practical DJ set-context sentence: what kind of party, room, or crowd the track likely fits, and whether it is better for opening, warmup, peak-time, transition, or closing.
When track-level genre is missing but the artist or matched track is found, use available artist context from provider evidence, such as Spotify artist genres, artist name, album, track title, BPM, and key, to infer a likely vibe. Make it clear in the summary or reviewNotes that this is inferred from artist/provider context.
If provider evidence contains artist genre/context data, do not return a null summary only because the track genre field is missing.
Use Wikipedia context when providerEvidence.wikipedia.found is true, especially for artist background, associated styles, scene, and cultural context. Treat Wikipedia as context for vibe and genre inference, not as proof of exact BPM/key.
Do not claim you searched Wikipedia unless providerEvidence.wikipedia is present and found.
Base set-context advice only on the provided BPM, genre, artist/track metadata, and provider evidence. Do not claim online/forum reputation unless it is present in provider evidence.
Prefer concrete provider values over broad artist genres.
Prefer Beatport BPM/key/genre when the matched track is strong because it is DJ-catalog track-level evidence.
Keep null when evidence is missing.`),
      new HumanMessage(
        JSON.stringify({
          currentResult: baseResult,
          providerEvidence,
          requiredShape: {
            operation: "analyze | enrich",
            trackName: "string",
            artist: "string",
            album: "string | null",
            spotifyUrl: "string | null",
            summary:
              "short user-facing string with one DJ set-context sentence | null",
            bpm: "number | null",
            genre: "string | null",
            subGenre: "string | null",
            key: "string | null",
            sources: "same object as currentResult.sources",
            confidence: "same object as currentResult.confidence",
            toolsUsed: "same array as currentResult.toolsUsed",
            reviewNotes: "short user-facing strings",
            conflicts: "short strings when provider evidence disagrees",
            status: "complete | partial | missing",
            errors: "same array as currentResult.errors when present",
          },
        }),
      ),
    ]);

    const parsed = parseJsonObject(getMessageContent(response));
    const merged = mergeSynthesis(baseResult, parsed);
    return repairStructuredGenreFromSummary(merged, providerEvidence);
  } catch (error) {
    return {
      ...addFallbackReviewNotes(baseResult),
      errors: [
        ...(baseResult.errors ?? []),
        error instanceof Error ? error.message : String(error),
      ],
    };
  }
}

function getBeatportClassification(value: unknown): BeatportSearchDecision["classification"] {
  return value === "edm" || value === "unknown" || value === "not_edm"
    ? value
    : "unknown";
}

function mergeSynthesis(
  baseResult: EnrichedTrackMetadata,
  parsed: Record<string, unknown> | null,
): EnrichedTrackMetadata {
  if (!parsed) {
    return addFallbackReviewNotes(baseResult);
  }
  const bpm = getNullableNumber(parsed.bpm) ?? baseResult.bpm;
  const genre = getNullableString(parsed.genre) ?? baseResult.genre;

  return {
    ...baseResult,
    trackName: baseResult.trackName,
    artist: baseResult.artist,
    album: getNullableString(parsed.album) ?? baseResult.album,
    spotifyUrl: getNullableString(parsed.spotifyUrl) ?? baseResult.spotifyUrl,
    summary: getNullableString(parsed.summary) ?? baseResult.summary,
    bpm,
    genre,
    subGenre: getNullableString(parsed.subGenre) ?? baseResult.subGenre,
    key: getNullableString(parsed.key) ?? baseResult.key,
    reviewNotes: getStringArray(parsed.reviewNotes) ?? baseResult.reviewNotes,
    conflicts: getStringArray(parsed.conflicts) ?? baseResult.conflicts,
    status: getEnrichmentStatus(bpm, genre),
  };
}

async function repairStructuredGenreFromSummary(
  result: EnrichedTrackMetadata,
  providerEvidence: ProviderEvidence,
): Promise<EnrichedTrackMetadata> {
  if (result.genre || !result.summary || (!process.env.OPENAI_API_KEY && !process.env.OPEN_AI_KEY)) {
    return result;
  }

  try {
    const response = await synthesisModel.invoke([
      new SystemMessage(`You repair inconsistent music metadata.
Return only strict JSON.
The current result has a non-null summary but null genre.
If the summary and provider evidence support a DJ-library genre, return that genre and optional subGenre.
If they do not support a genre, return null.
Do not use hard-coded keyword matching. Interpret the summary and evidence.
Do not invent BPM, key, album, URLs, or provider matches.`),
      new HumanMessage(
        JSON.stringify({
          currentResult: result,
          providerEvidence,
          requiredShape: {
            genre: "string | null",
            subGenre: "string | null",
            reviewNotes: "short user-facing strings",
          },
        }),
      ),
    ]);
    const parsed = parseJsonObject(getMessageContent(response));

    if (!parsed) {
      return result;
    }

    const genre = getNullableString(parsed.genre);
    const subGenre = getNullableString(parsed.subGenre);

    if (!genre) {
      return {
        ...result,
        reviewNotes: getStringArray(parsed.reviewNotes) ?? result.reviewNotes,
      };
    }

    return {
      ...result,
      genre,
      subGenre: subGenre ?? result.subGenre,
      sources: {
        ...result.sources,
        genre: result.sources.genre ?? "unknown",
        subGenre: result.sources.subGenre ?? result.sources.genre ?? "unknown",
      },
      confidence: {
        ...result.confidence,
        genre: result.confidence.genre ?? 0.55,
        subGenre: result.confidence.subGenre ?? result.confidence.genre ?? 0.55,
      },
      reviewNotes: getStringArray(parsed.reviewNotes) ?? [
        ...(result.reviewNotes ?? []),
        `Genre inferred by review from summary and provider evidence: ${genre}.`,
      ],
      status: result.bpm ? "complete" : "partial",
    };
  } catch (error) {
    return {
      ...result,
      errors: [
        ...(result.errors ?? []),
        error instanceof Error ? error.message : String(error),
      ],
    };
  }
}

function addFallbackReviewNotes(
  result: EnrichedTrackMetadata,
): EnrichedTrackMetadata {
  if (result.reviewNotes && result.reviewNotes.length > 0) {
    return result;
  }

  return {
    ...result,
    reviewNotes: [
      result.status === "complete"
        ? "BPM and genre were found from provider evidence."
        : "Some metadata is still missing and should be reviewed manually.",
    ],
  };
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

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNullableString(value: unknown) {
  return value === null ? null : getString(value);
}

function getNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const values = value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
  return values.length > 0 ? values : null;
}
