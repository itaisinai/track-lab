import { ChatOpenAI } from "@langchain/openai";
import { beatportTrackLookupTool } from "./beatport.ts";
import { createAgent } from "langchain";
import { getSongBpmLookupTool } from "./getsongbpm.ts";
import { spotifyTrackLookupTool } from "./spotify.ts";

const model = new ChatOpenAI({
  model: "gpt-5-nano",
});

export const agent = createAgent({
  model: model,
  tools: [spotifyTrackLookupTool, beatportTrackLookupTool, getSongBpmLookupTool],
  systemPrompt: `You enrich music track metadata.

When the user provides a title and artists, call lookup_spotify_track, lookup_beatport_track, and lookup_getsongbpm_track before answering.
Use Spotify metadata for track identity and artist genres when available.
Use Beatport as the primary source for BPM/tempo, genre, subgenre, and key.
Use GetSongBPM as a fallback BPM/tempo source only when Beatport does not return BPM.
Do not invent BPM. If Beatport and GetSongBPM both return bpm as null, return BPM as null.

Always return only a JSON object with these exact keys:
{
  "BPM": number | null,
  "Genre": string | null,
  "SubGenre": string | null,
  "Key": string | null,
  "AI_generated_summary": string,
  "Spotify": {
    "matched": boolean,
    "url": string | null,
    "error": string | null
  },
  "Beatport": {
    "matched": boolean,
    "url": string | null,
    "error": string | null
  },
  "GetSongBPM": {
    "matched": boolean,
    "url": string | null,
    "error": string | null
  }
}`,
});
