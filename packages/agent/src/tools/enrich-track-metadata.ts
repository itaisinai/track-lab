import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { agentTrackResultStore } from "../datastore/agent-track-result-store.ts";
import { createDatastoreEnrichmentStore } from "../enrichment/enrichment-result-store.ts";
import { enrichTrackMetadata } from "../enrichment/track-metadata-enrichment.ts";

export const enrichTrackMetadataTool = tool(
  async (input) =>
    JSON.stringify(
      await enrichTrackMetadata(input, {
        store: createDatastoreEnrichmentStore(agentTrackResultStore),
      }),
    ),
  {
    name: "enrich_track_metadata",
    description:
      "Enrich track BPM, genre, and key using datastore, Rekordbox XML, optional audio-analysis placeholder, and provider fallbacks.",
    schema: z.object({
      operation: z
        .enum(["analyze", "enrich"])
        .optional()
        .describe("Analyze may reuse saved data. Enrich skips saved data and refreshes providers."),
      trackName: z.string().describe("Track title/name."),
      artist: z.string().optional().describe("Artist name when available."),
      knownMetadata: z
        .object({
          album: z.string().nullable().optional(),
          bpm: z.number().nullable().optional(),
          genre: z.string().nullable().optional(),
          subGenre: z.string().nullable().optional(),
          key: z.string().nullable().optional(),
          spotifyUrl: z.string().nullable().optional(),
        })
        .optional()
        .describe("Existing user-reviewed or saved metadata for enrich operations."),
    }),
  },
);
