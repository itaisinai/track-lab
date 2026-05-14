import { tool } from "@langchain/core/tools";
import type { SearchRemixesToolInput } from "@track-lab/api-types";
import type { RemixSearchOrchestrator } from "@track-lab/remix-search";
import { z } from "zod";

export const searchRemixesToolName = "search_remixes" as const;

export const searchRemixesSchema = z.object({
  title: z.string().nullable().optional(),
  artists: z.string().nullable().optional(),
  spotifyUrl: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
});

export function createSearchRemixesTool(
  execute: (input: SearchRemixesToolInput) => Promise<unknown>,
) {
  return tool(
    async (input) => JSON.stringify(await execute(normalizeSearchRemixesInput(input))),
    {
      name: searchRemixesToolName,
      description:
        "Search for remixes, edits, bootlegs, and reworks for a user-facing track request.",
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
  remixSearch: RemixSearchOrchestrator,
) {
  return remixSearch.search(input);
}
