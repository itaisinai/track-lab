import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { enrichmentTrackResultStore } from "../datastore/enrichment-track-result-store.ts";
import { createSavedTrackLookupResponse } from "../datastore/saved-track-lookup-response.ts";

export const savedTrackLookupTool = tool(
  async (input) =>
    JSON.stringify(
      createSavedTrackLookupResponse(
        enrichmentTrackResultStore.findByTrack(input.title, input.artists),
      ),
    ),
  {
    name: "lookup_saved_track_result",
    description:
      "Look up previously indexed track enrichment data in the local Track Lab datastore by title and artists. Use this before any external provider lookup. If found is true, use the returned JSON and do not call external provider tools.",
    schema: z.object({
      title: z.string().describe("The track title to search for."),
      artists: z.string().describe("Comma-separated artist names."),
    }),
  },
);
