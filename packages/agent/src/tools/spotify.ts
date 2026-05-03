import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { lookupSpotifyTrack } from "../providers/spotify.ts";

export const spotifyTrackLookupTool = tool(
  async (input) => JSON.stringify(await lookupSpotifyTrack(input)),
  {
    name: "lookup_spotify_track",
    description:
      "Search Spotify for public track metadata by title and artists. Returns the matched track, artist genres, Spotify URL, and null BPM because Spotify BPM endpoints are deprecated.",
    schema: z.object({
      title: z.string().describe("The track title to search for."),
      artists: z.string().describe("Comma-separated artist names."),
    }),
  },
);
