import { tool } from "@langchain/core/tools";
import type { AnalyzeTrackToolInput } from "@track-lab/api-types";
import type { TrackAnalysisOrchestrator } from "@track-lab/track-analysis";
import { z } from "zod";

export const analyzeTrackToolName = "analyze_track" as const;

export const analyzeTrackSchema = z.object({
  title: z.string().describe("Track title/name."),
  artists: z.string().describe("Artist name or artist list."),
  operation: z.enum(["analyze", "enrich"]).optional(),
  knownMetadata: z
    .object({
      album: z.string().nullable().optional(),
      bpm: z.number().nullable().optional(),
      genre: z.string().nullable().optional(),
      subGenre: z.string().nullable().optional(),
      key: z.string().nullable().optional(),
      spotifyUrl: z.string().nullable().optional(),
    })
    .optional(),
});

export function createAnalyzeTrackTool(
  execute: (input: AnalyzeTrackToolInput) => Promise<unknown>,
) {
  return tool(
    async (input) => JSON.stringify(await execute(normalizeAnalyzeTrackInput(input))),
    {
      name: analyzeTrackToolName,
      description:
        "Analyze or enrich user-facing track metadata. Providers remain internal.",
      schema: analyzeTrackSchema,
    },
  );
}

export function normalizeAnalyzeTrackInput(input: unknown): AnalyzeTrackToolInput {
  const parsed = analyzeTrackSchema.parse(input);
  return {
    title: parsed.title.trim(),
    artists: parsed.artists.trim(),
    operation: parsed.operation ?? "enrich",
    knownMetadata: parsed.knownMetadata,
  };
}

export function executeAnalyzeTrackTool(
  input: AnalyzeTrackToolInput,
  orchestrator: TrackAnalysisOrchestrator,
) {
  const operation = input.operation ?? "enrich";
  const job = orchestrator.enqueue({
    operation,
    track: {
      title: input.title,
      artists: input.artists,
    },
    source: "manual",
    knownMetadata: operation === "enrich" ? input.knownMetadata : undefined,
  });

  return {
    job: {
      id: job.id,
      status: job.status,
      operation: job.operation,
    },
  };
}
