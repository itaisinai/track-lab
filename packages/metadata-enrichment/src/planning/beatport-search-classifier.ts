import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import type { EnrichedTrackMetadata } from "../enrichment/types.ts";
import type { ProviderEvidence } from "../enrichment/provider-evidence.ts";

export type BeatportSearchDecision = {
  shouldSearch: boolean;
  classification: "edm" | "unknown" | "not_edm";
  reason?: string;
};

type BeatportSearchClassificationInput = {
  baseResult: EnrichedTrackMetadata;
  providerEvidence: ProviderEvidence;
};

const synthesisModel = new ChatOpenAI({
  model: "gpt-5-nano",
  apiKey: process.env.OPENAI_API_KEY,
});

export async function classifyBeatportSearchNeed({
  baseResult,
  providerEvidence,
}: BeatportSearchClassificationInput): Promise<BeatportSearchDecision> {
  if (!process.env.OPENAI_API_KEY) {
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

function getBeatportClassification(value: unknown): BeatportSearchDecision["classification"] {
  return value === "edm" || value === "unknown" || value === "not_edm"
    ? value
    : "unknown";
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

function getString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}
