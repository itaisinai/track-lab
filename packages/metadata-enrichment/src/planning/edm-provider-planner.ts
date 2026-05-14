import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import type { EnrichedTrackMetadata } from "../enrichment/types.ts";
import type { PlannerCurrentResultSummary, PlannerProviderEvidenceSummary } from "./planner-input.ts";

export type EdmProviderPlan = {
  classification: "edm" | "unknown" | "not_edm";
  shouldRunEdmProviders: boolean;
  providersToRun: Array<"beatport" | "soundcloud">;
  confidence: "high" | "medium" | "low";
  reason: string;
  decidedBy: "deterministic" | "llm" | "fallback";
};

export type EdmProviderPlannerInput = {
  currentResult: EnrichedTrackMetadata;
  currentResultSummary: PlannerCurrentResultSummary;
  providerEvidenceSummary: PlannerProviderEvidenceSummary;
};

const edmPlannerModel = new ChatOpenAI({
  model: "gpt-5-nano",
  apiKey: process.env.OPENAI_API_KEY,
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

export async function planEdmProviders(
  input: EdmProviderPlannerInput,
): Promise<EdmProviderPlan> {
  const deterministic = classifyEdmDeterministically(input);

  if (deterministic.classification !== "unknown") {
    return deterministic;
  }

  if (!hasOpenAiKey()) {
    return {
      classification: "unknown",
      shouldRunEdmProviders: false,
      providersToRun: [],
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
            shouldRunEdmProviders: "boolean",
            providersToRun: ["beatport", "soundcloud"],
            confidence: "high | medium | low",
            reason: "short string",
          },
        }),
      ),
    ]);
    const parsed = parseJsonObject(getMessageContent(response));
    const classification = parseClassification(parsed?.classification);
    const providersToRun = parseProvidersToRun(
      parsed?.providersToRun,
      classification,
    );

    return {
      classification,
      shouldRunEdmProviders:
        typeof parsed?.shouldRunEdmProviders === "boolean"
          ? parsed.shouldRunEdmProviders
          : classification === "edm",
      providersToRun,
      confidence: parseConfidence(parsed?.confidence) ?? "medium",
      reason: getString(parsed?.reason) ?? deterministic.reason,
      decidedBy: "llm",
    };
  } catch (error) {
    return {
      classification: "unknown",
      shouldRunEdmProviders: false,
      providersToRun: [],
      confidence: "low",
      reason: error instanceof Error ? error.message : String(error),
      decidedBy: "fallback",
    };
  }
}

export function classifyEdmDeterministically(
  input: EdmProviderPlannerInput,
): EdmProviderPlan {
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
      shouldRunEdmProviders: true,
      providersToRun: ["beatport", "soundcloud"],
      confidence: "high",
      reason: "Deterministic EDM signal detected from current metadata and provider evidence.",
      decidedBy: "deterministic",
    };
  }

  if (hasNonEdmSignal && !hasEdmSignal) {
    return {
      classification: "not_edm",
      shouldRunEdmProviders: false,
      providersToRun: [],
      confidence: "high",
      reason: "Deterministic non-EDM signal detected from current metadata and provider evidence.",
      decidedBy: "deterministic",
    };
  }

  return {
    classification: "unknown",
    shouldRunEdmProviders: false,
    providersToRun: [],
    confidence: "low",
    reason: "EDM relevance is ambiguous from deterministic signals.",
    decidedBy: "deterministic",
  };
}

function parseClassification(value: unknown): EdmProviderPlan["classification"] {
  return value === "edm" || value === "unknown" || value === "not_edm"
    ? value
    : "unknown";
}

function parseConfidence(value: unknown): EdmProviderPlan["confidence"] | null {
  return value === "high" || value === "medium" || value === "low"
    ? value
    : null;
}

function parseProvidersToRun(
  value: unknown,
  classification: EdmProviderPlan["classification"],
): EdmProviderPlan["providersToRun"] {
  const edmProviders: EdmProviderPlan["providersToRun"] = [
    "beatport",
    "soundcloud",
  ];

  if (!Array.isArray(value)) {
    return classification === "edm" ? edmProviders : [];
  }

  const providers = value.filter(
    (item): item is "beatport" | "soundcloud" =>
      item === "beatport" || item === "soundcloud",
  );

  return providers.length > 0
    ? (Array.from(new Set(providers)) as EdmProviderPlan["providersToRun"])
    : classification === "edm"
      ? edmProviders
      : [];
}

function hasOpenAiKey() {
  return Boolean(process.env.OPENAI_API_KEY);
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
