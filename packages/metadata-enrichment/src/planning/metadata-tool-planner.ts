import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import type { EnrichedTrackMetadata, EnrichTrackMetadataInput } from "../enrichment/types.ts";
import type { ProviderEvidence } from "../enrichment/llm-synthesis.ts";
import {
  flattenPlannerPolicyContext,
  getPlannerPolicyContext,
  type PlannerPolicyContext,
} from "./planner-policy-context.ts";
import {
  planEdmTools,
  type EdmToolPlan,
} from "./edm-tool-planner.ts";
import {
  toPlannerCurrentResultSummary,
  toPlannerProviderEvidenceSummary,
} from "./planner-input.ts";

export type MetadataToolPlan = {
  lookupBpmProvider: boolean;
  lookupEdmCatalogProviders: boolean;
  lookupContextProvider: boolean;
  reasons: string[];
  strategyContext: PlannerPolicyContext;
  edmToolPlan: EdmToolPlan;
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
  const strategyContext = getPlannerPolicyContext(input);
  const currentResultSummary = toPlannerCurrentResultSummary(input.currentResult);
  const providerEvidenceSummary = toPlannerProviderEvidenceSummary(
    input.providerEvidence,
  );
  const edmToolPlan = await planEdmTools({
    currentResult: input.currentResult,
    currentResultSummary,
    providerEvidenceSummary,
  });

  if (!process.env.OPENAI_API_KEY && !process.env.OPEN_AI_KEY) {
    return {
      ...createFallbackPlan(input, edmToolPlan),
      strategyContext,
      edmToolPlan,
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
- Planner policy context is internal policy, provider guidance, and user preferences.
- The tool planner decides optional tools from current evidence and planner policy context.

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
          currentResult: currentResultSummary,
          providerEvidence: providerEvidenceSummary,
          retrievedContext: flattenPlannerPolicyContext(strategyContext),
          edmToolPlan,
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
        getBoolean(parsed?.lookupEdmCatalogProviders) ??
        edmToolPlan.shouldRunEdmTools,
      lookupContextProvider:
        getBoolean(parsed?.lookupContextProvider) ?? shouldLookupContext(input),
      reasons: getStringArray(parsed?.reasons) ?? createFallbackReasons(input, edmToolPlan),
      strategyContext,
      edmToolPlan,
    };
  } catch (error) {
    return {
      ...createFallbackPlan(input, edmToolPlan, error),
      strategyContext,
      edmToolPlan,
    };
  }
}

function createFallbackPlan(
  input: MetadataToolPlanInput,
  edmToolPlan: EdmToolPlan,
  error?: unknown,
): Omit<MetadataToolPlan, "strategyContext"> {
  return {
    lookupBpmProvider: shouldLookupBpm(input),
    lookupEdmCatalogProviders: edmToolPlan.shouldRunEdmTools,
    lookupContextProvider: shouldLookupContext(input),
    reasons: createFallbackReasons(input, edmToolPlan, error),
    edmToolPlan,
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

function createFallbackReasons(
  input: MetadataToolPlanInput,
  edmToolPlan: EdmToolPlan,
  error?: unknown,
) {
  const reasons: string[] = [];

  if (shouldLookupBpm(input)) {
    reasons.push("BPM or key is missing, so GetSongBPM is useful.");
  }

  if (edmToolPlan.shouldRunEdmTools) {
    reasons.push("EDM tools should run based on deterministic or LLM EDM planning.");
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
