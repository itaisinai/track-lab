import type { EnrichedTrackMetadata, EnrichTrackMetadataInput } from "../enrichment/types.ts";
import type { ProviderEvidence } from "../enrichment/llm-synthesis.ts";

// Static planner policy context added directly to the LLM prompt to keep
// provider planning consistent.
export type PlannerPolicyContext = {
  policy: string[];
  providerRules: string[];
  userPreferences: string[];
};

export type PlannerPolicyContextInput = {
  input: EnrichTrackMetadataInput;
  currentResult: EnrichedTrackMetadata;
  providerEvidence: ProviderEvidence;
};

export function getPlannerPolicyContext({
  input,
  currentResult,
}: PlannerPolicyContextInput): PlannerPolicyContext {
  const policy = [
    "Providers fetch evidence. The LLM interprets evidence and plans optional provider calls.",
    "Never invent BPM, key, URLs, provider matches, or saved results.",
    "Manual user-reviewed data is more trusted than automatic provider data.",
    "Prefer specific DJ-library genres over generic values such as electronic or dance.",
  ];
  const providerRules = [
    "Spotify is useful for track identity, album, URL, and artist genres, but not BPM.",
    "GetSongBPM is useful when BPM or key is missing.",
    "Beatport is useful for official or commercially released EDM catalog tracks, including DJ-library BPM, key, genre, and release metadata.",
    "SoundCloud track search is useful for EDM tracks uploaded by users, artists, labels, and collectives, including unofficial uploads, bootlegs, edits, flips, and underground scene tracks.",
    "Beatport and SoundCloud metadata search cover different parts of the EDM ecosystem and are one EDM optional group: call both or call neither.",
    "Wikipedia is context only. Use it for artist, scene, and genre background, not BPM or key truth.",
  ];
  const userPreferences = [
    "Keep save manual; worker results are review artifacts.",
    "Use SoundCloud for EDM-like tracks, not for every mainstream track.",
    "When a requested or inferred genre is bass, accept related EDM styles such as dubstep, trap, future bass, drum and bass, UK bass, and bass music.",
  ];

  if (input.knownMetadata?.genre || currentResult.genre) {
    userPreferences.push(
      `Current genre signal: ${input.knownMetadata?.genre ?? currentResult.genre}.`,
    );
  }

  return {
    policy,
    providerRules,
    userPreferences,
  };
}

export function flattenPlannerPolicyContext(context: PlannerPolicyContext) {
  return [
    ...context.policy.map((item) => `Policy: ${item}`),
    ...context.providerRules.map((item) => `Provider rule: ${item}`),
    ...context.userPreferences.map((item) => `User preference: ${item}`),
  ];
}
