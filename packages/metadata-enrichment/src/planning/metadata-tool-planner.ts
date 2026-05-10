import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import type { EnrichedTrackMetadata, EnrichTrackMetadataInput } from "../enrichment/types.ts";
import type { ProviderEvidence } from "../enrichment/llm-synthesis.ts";
import {
  flattenMetadataStrategyContext,
  retrieveMetadataStrategyContext,
  type MetadataStrategyContext,
} from "./rag-context.ts";

export type MetadataToolPlan = {
  lookupBpmProvider: boolean;
  lookupEdmCatalogProviders: boolean;
  lookupContextProvider: boolean;
  reasons: string[];
  strategyContext: MetadataStrategyContext;
};

export type MetadataToolPlanInput = {
  input: EnrichTrackMetadataInput;
  currentResult: EnrichedTrackMetadata;
  providerEvidence: ProviderEvidence;
};

const plannerModel = new ChatOpenAI({
  model: "gpt-5-nano",
  apiKey: process.env.OPENAI_API_KEY ?? process.env.OPEN_AI_KEY,
});

export async function planMetadataTools(
  input: MetadataToolPlanInput,
): Promise<MetadataToolPlan> {
  const strategyContext = retrieveMetadataStrategyContext(input);

  if (!process.env.OPENAI_API_KEY && !process.env.OPEN_AI_KEY) {
    return {
      ...createFallbackPlan(input),
      strategyContext,
    };
  }

  try {
    const response = await plannerModel.invoke([
      new SystemMessage(`You are the Track Lab metadata tool planner.
Return only strict JSON.
You do not fetch data and you do not produce final metadata.
Your job is to decide which optional tool groups should run next.

Important terminology:
- Tools/providers fetch evidence.
- RAG context is internal policy, memory, and user preferences.
- The tool planner decides optional tools from current evidence and RAG context.

Rules:
- GetSongBPM should run when BPM or key is missing and title/artist are available.
- Beatport and SoundCloud metadata search are one EDM evidence group. They must be called both or neither.
- Beatport is for official/released EDM catalog evidence. SoundCloud is for EDM user-uploaded, unofficial, bootleg, edit, flip, and underground evidence.
- The EDM evidence group should run only when the track is likely EDM/DJ/club/remix/bass/underground, or evidence is too weak and the track may be EDM.
- Wikipedia context should run when genre, scene, artist context, conflicts, or summary context are unclear.
- Avoid unnecessary tools when current evidence is already strong.
- Return short reasons.`),
      new HumanMessage(
        JSON.stringify({
          currentResult: input.currentResult,
          providerEvidence: input.providerEvidence,
          retrievedContext: flattenMetadataStrategyContext(strategyContext),
          requiredShape: {
            lookupBpmProvider: "boolean",
            lookupEdmCatalogProviders: "boolean",
            lookupContextProvider: "boolean",
            reasons: "short string[]",
          },
        }),
      ),
    ]);
    const parsed = parseJsonObject(getMessageContent(response));

    return {
      lookupBpmProvider: getBoolean(parsed?.lookupBpmProvider) ?? shouldLookupBpm(input),
      lookupEdmCatalogProviders:
        getBoolean(parsed?.lookupEdmCatalogProviders) ?? shouldLookupEdmCatalog(input),
      lookupContextProvider:
        getBoolean(parsed?.lookupContextProvider) ?? shouldLookupContext(input),
      reasons: getStringArray(parsed?.reasons) ?? createFallbackReasons(input),
      strategyContext,
    };
  } catch (error) {
    return {
      ...createFallbackPlan(input, error),
      strategyContext,
    };
  }
}

function createFallbackPlan(
  input: MetadataToolPlanInput,
  error?: unknown,
): Omit<MetadataToolPlan, "strategyContext"> {
  return {
    lookupBpmProvider: shouldLookupBpm(input),
    lookupEdmCatalogProviders: shouldLookupEdmCatalog(input),
    lookupContextProvider: shouldLookupContext(input),
    reasons: createFallbackReasons(input, error),
  };
}

function shouldLookupBpm({ currentResult }: MetadataToolPlanInput) {
  return !currentResult.bpm || !currentResult.key;
}

function shouldLookupContext({ input, currentResult }: MetadataToolPlanInput) {
  return Boolean(
    input.operation === "enrich" ||
      !currentResult.genre ||
      !currentResult.summary,
  );
}

function shouldLookupEdmCatalog({ input, currentResult }: MetadataToolPlanInput) {
  const values = [
    input.trackName,
    input.artist,
    input.knownMetadata?.genre,
    input.knownMetadata?.subGenre,
    currentResult.trackName,
    currentResult.artist,
    currentResult.genre,
    currentResult.subGenre,
    currentResult.summary,
  ];
  const text = values
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  return [
    "edm",
    "electronic",
    "house",
    "techno",
    "trance",
    "dubstep",
    "drum and bass",
    "dnb",
    "bass",
    "trap",
    "garage",
    "club",
    "dance",
    "remix",
    "edit",
    "bootleg",
    "flip",
    "dj",
  ].some((term) => text.includes(term));
}

function createFallbackReasons(input: MetadataToolPlanInput, error?: unknown) {
  const reasons: string[] = [];

  if (shouldLookupBpm(input)) {
    reasons.push("BPM or key is missing, so GetSongBPM is useful.");
  }

  if (shouldLookupEdmCatalog(input)) {
    reasons.push("EDM/DJ catalog signal exists, so Beatport and SoundCloud should run together.");
  }

  if (shouldLookupContext(input)) {
    reasons.push("Genre or summary context is incomplete, so Wikipedia context is useful.");
  }

  if (error) {
    reasons.push(
      `Planner fallback used: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return reasons;
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

function getBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
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
