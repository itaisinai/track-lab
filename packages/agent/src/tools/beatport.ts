import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { lookupBeatportTrack } from "../providers/beatport.ts";

export const beatportTrackLookupTool = tool(
  async (input) => JSON.stringify(await lookupBeatportTrack(input)),
  {
    name: "lookup_beatport_track",
    description:
      "Search Beatport catalog tracks by title and artist. Returns EDM-focused metadata including BPM, genre, subgenre, key, label, release, and URL when available.",
    schema: z.object({
      title: z.string().describe("The track title to search for."),
      artists: z.string().describe("Comma-separated artist names."),
    }),
  },
);
