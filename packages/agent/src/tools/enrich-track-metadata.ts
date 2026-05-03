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
      trackName: z.string().describe("Track title/name."),
      artist: z.string().optional().describe("Artist name when available."),
      rekordboxXmlPath: z
        .string()
        .optional()
        .describe("Local path to a rekordbox.xml export."),
      filePath: z
        .string()
        .optional()
        .describe("Local audio file path for future audio analysis."),
    }),
  },
);
