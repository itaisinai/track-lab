import { tool } from "@langchain/core/tools";
import type { SearchRemixesToolInput } from "@track-lab/api-types";
import type { TrackAnalysisOrchestrator } from "@track-lab/track-analysis";
import { z } from "zod";

export const searchRemixesToolName = "search_remixes" as const;

export const searchRemixesSchema = z.object({
  title: z.string().nullable().optional().describe("Original track title. Use current session focus for follow-ups when omitted."),
  artists: z.string().nullable().optional().describe("Original track artist(s). Use current session focus for follow-ups when omitted."),
  spotifyUrl: z.string().nullable().optional().describe("Spotify track URL for the original track, when provided."),
  genre: z
    .string()
    .nullable()
    .optional()
    .describe("Requested remix style or genre from the user's wording, e.g. bass, house, techno, dubstep, drum and bass, melodic."),
});

export function createSearchRemixesTool(
  execute: (input: SearchRemixesToolInput) => Promise<unknown>,
) {
  return tool(
    async (input) => JSON.stringify(await execute(normalizeSearchRemixesInput(input))),
    {
      name: searchRemixesToolName,
      description:
        "Search for remixes, edits, bootlegs, and reworks for a user-facing track request. Pass genre when the user asks for a style-specific search such as bass remixes or house edits.",
      schema: searchRemixesSchema,
    },
  );
}

export function normalizeSearchRemixesInput(input: unknown): SearchRemixesToolInput {
  const parsed = searchRemixesSchema.parse(input);
  return {
    title: parsed.title?.trim() || null,
    artists: parsed.artists?.trim() || null,
    spotifyUrl: parsed.spotifyUrl?.trim() || null,
    genre: parsed.genre?.trim() || null,
  };
}

export function executeSearchRemixesTool(
  input: SearchRemixesToolInput,
  orchestrator: TrackAnalysisOrchestrator,
) {
  const job = orchestrator.enqueue({
    operation: "remix_search",
    request: input,
  });

  return {
    job: {
      id: job.id,
      status: job.status,
      operation: job.operation,
    },
  };
}
