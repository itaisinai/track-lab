import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import type { EnrichedTrackMetadata } from "./types.ts";

export type ProviderEvidence = {
  spotify?: unknown;
  getSongBpm?: unknown;
};

type SynthesisInput = {
  baseResult: EnrichedTrackMetadata;
  providerEvidence: ProviderEvidence;
};

const synthesisModel = new ChatOpenAI({
  model: "gpt-5-nano",
});

export async function synthesizeEnrichedTrackMetadata({
  baseResult,
  providerEvidence,
}: SynthesisInput): Promise<EnrichedTrackMetadata> {
  if (!process.env.OPENAI_API_KEY) {
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
Base set-context advice only on the provided BPM, genre, artist/track metadata, and provider evidence. Do not claim online/forum reputation unless it is present in provider evidence.
Prefer concrete provider values over broad artist genres.
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
    return mergeSynthesis(baseResult, parsed);
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

function mergeSynthesis(
  baseResult: EnrichedTrackMetadata,
  parsed: Record<string, unknown> | null,
): EnrichedTrackMetadata {
  if (!parsed) {
    return addFallbackReviewNotes(baseResult);
  }

  return {
    ...baseResult,
    trackName: getString(parsed.trackName) ?? baseResult.trackName,
    artist: getString(parsed.artist) ?? baseResult.artist,
    album: getNullableString(parsed.album) ?? baseResult.album,
    spotifyUrl: getNullableString(parsed.spotifyUrl) ?? baseResult.spotifyUrl,
    summary: getNullableString(parsed.summary) ?? baseResult.summary,
    bpm: getNullableNumber(parsed.bpm) ?? baseResult.bpm,
    genre: getNullableString(parsed.genre) ?? baseResult.genre,
    subGenre: getNullableString(parsed.subGenre) ?? baseResult.subGenre,
    key: getNullableString(parsed.key) ?? baseResult.key,
    reviewNotes: getStringArray(parsed.reviewNotes) ?? baseResult.reviewNotes,
    conflicts: getStringArray(parsed.conflicts) ?? baseResult.conflicts,
    status: isStatus(parsed.status) ? parsed.status : baseResult.status,
  };
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

function isStatus(value: unknown): value is EnrichedTrackMetadata["status"] {
  return value === "complete" || value === "partial" || value === "missing";
}
