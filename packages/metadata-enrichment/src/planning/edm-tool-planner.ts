import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import type { EnrichedTrackMetadata } from "../enrichment/types.ts";
import type { PlannerCurrentResultSummary, PlannerProviderEvidenceSummary } from "./planner-input.ts";

export type EdmToolPlan = {
  classification: "edm" | "unknown" | "not_edm";
  shouldRunEdmTools: boolean;
  toolsToRun: Array<"beatport" | "soundcloud">;
  confidence: "high" | "medium" | "low";
  reason: string;
  decidedBy: "deterministic" | "llm" | "fallback";
};

export type EdmToolPlannerInput = {
  currentResult: EnrichedTrackMetadata;
  currentResultSummary: PlannerCurrentResultSummary;
  providerEvidenceSummary: PlannerProviderEvidenceSummary;
};

const edmPlannerModel = new ChatOpenAI({
  model: "gpt-5-nano",
  apiKey: process.env.OPENAI_API_KEY ?? process.env.OPEN_AI_KEY,
});

const EDM_SIGNAL_TERMS = [
  "edm",
  "electronic",
  "house",
  "techno",
  "trance",
  "dubstep",
  "dnb",
  "drum and bass",
  "bass",
  "remix",
  "edit",
  "bootleg",
  "flip",
  "vip",
  "rework",
  "dj",
  "club",
];

const NON_EDM_SIGNAL_TERMS = [
  "pop",
  "hip hop",
  "hip-hop",
  "rap",
  "r&b",
  "rock",
  "acoustic",
  "singer-songwriter",
  "country",
  "jazz",
  "classical",
];

export async function planEdmTools(
  input: EdmToolPlannerInput,
): Promise<EdmToolPlan> {
  const deterministic = classifyEdmDeterministically(input);

  if (deterministic.classification !== "unknown") {
    return deterministic;
  }

  if (!hasOpenAiKey()) {
    return {
      classification: "unknown",
      shouldRunEdmTools: false,
      toolsToRun: [],
      confidence: "low",
      reason: "Ambiguous EDM signal and no OpenAI key configured.",
      decidedBy: "fallback",
    };
  }

  try {
    const response = await edmPlannerModel.invoke([
      new SystemMessage(`Classify whether Beatport and SoundCloud should run for this track.
Return only strict JSON.
Use "edm" when the track is likely EDM, DJ, club, remix, bass, or underground dance music.
Use "not_edm" when the track is clearly non-EDM.
Use "unknown" when evidence is ambiguous.
Do not classify as EDM only because BPM or key exists.`),
      new HumanMessage(
        JSON.stringify({
          currentResult: input.currentResultSummary,
          providerEvidence: input.providerEvidenceSummary,
          policyContext: {
            note: "Static planner policy context.",
          },
          requiredShape: {
            classification: "edm | unknown | not_edm",
            shouldRunEdmTools: "boolean",
            toolsToRun: ["beatport", "soundcloud"],
            confidence: "high | medium | low",
            reason: "short string",
          },
        }),
      ),
    ]);
    const parsed = parseJsonObject(getMessageContent(response));
    const classification = parseClassification(parsed?.classification);
    const toolsToRun = parseToolsToRun(parsed?.toolsToRun, classification);

    return {
      classification,
      shouldRunEdmTools:
        typeof parsed?.shouldRunEdmTools === "boolean"
          ? parsed.shouldRunEdmTools
          : classification === "edm",
      toolsToRun,
      confidence: parseConfidence(parsed?.confidence) ?? "medium",
      reason: getString(parsed?.reason) ?? deterministic.reason,
      decidedBy: "llm",
    };
  } catch (error) {
    return {
      classification: "unknown",
      shouldRunEdmTools: false,
      toolsToRun: [],
      confidence: "low",
      reason: error instanceof Error ? error.message : String(error),
      decidedBy: "fallback",
    };
  }
}

export function classifyEdmDeterministically(
  input: EdmToolPlannerInput,
): EdmToolPlan {
  const text = [
    input.currentResultSummary.trackName,
    input.currentResultSummary.artist,
    input.currentResultSummary.genre,
    input.currentResultSummary.subGenre,
    input.providerEvidenceSummary.spotify,
    input.providerEvidenceSummary.beatport,
    input.providerEvidenceSummary.getSongBpm,
    input.providerEvidenceSummary.soundcloud,
    input.providerEvidenceSummary.wikipedia,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  const hasEdmSignal = EDM_SIGNAL_TERMS.some((term) => text.includes(term));
  const hasNonEdmSignal = NON_EDM_SIGNAL_TERMS.some((term) => text.includes(term));

  if (hasEdmSignal && !hasNonEdmSignal) {
    return {
      classification: "edm",
      shouldRunEdmTools: true,
      toolsToRun: ["beatport", "soundcloud"],
      confidence: "high",
      reason: "Deterministic EDM signal detected from current metadata and provider evidence.",
      decidedBy: "deterministic",
    };
  }

  if (hasNonEdmSignal && !hasEdmSignal) {
    return {
      classification: "not_edm",
      shouldRunEdmTools: false,
      toolsToRun: [],
      confidence: "high",
      reason: "Deterministic non-EDM signal detected from current metadata and provider evidence.",
      decidedBy: "deterministic",
    };
  }

  return {
    classification: "unknown",
    shouldRunEdmTools: false,
    toolsToRun: [],
    confidence: "low",
    reason: "EDM relevance is ambiguous from deterministic signals.",
    decidedBy: "deterministic",
  };
}

function parseClassification(value: unknown): EdmToolPlan["classification"] {
  return value === "edm" || value === "unknown" || value === "not_edm"
    ? value
    : "unknown";
}

function parseConfidence(value: unknown): EdmToolPlan["confidence"] | null {
  return value === "high" || value === "medium" || value === "low"
    ? value
    : null;
}

function parseToolsToRun(
  value: unknown,
  classification: EdmToolPlan["classification"],
): EdmToolPlan["toolsToRun"] {
  const edmTools: EdmToolPlan["toolsToRun"] = ["beatport", "soundcloud"];

  if (!Array.isArray(value)) {
    return classification === "edm" ? edmTools : [];
  }

  const tools = value.filter(
    (item): item is "beatport" | "soundcloud" =>
      item === "beatport" || item === "soundcloud",
  );

  return tools.length > 0
    ? (Array.from(new Set(tools)) as EdmToolPlan["toolsToRun"])
    : classification === "edm"
      ? edmTools
      : [];
}

function hasOpenAiKey() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY);
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
