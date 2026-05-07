import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { lookupGetSongBpmTrack } from "@track-lab/providers";

export const getSongBpmLookupTool = tool(
  async (input) => JSON.stringify(await lookupGetSongBpmTrack(input)),
  {
    name: "lookup_getsongbpm_track",
    description:
      "Look up BPM/tempo and related track metadata from GetSongBPM by track title and artists.",
    schema: z.object({
      title: z.string().describe("The track title to search for."),
      artists: z.string().describe("Comma-separated artist names."),
    }),
  },
);
