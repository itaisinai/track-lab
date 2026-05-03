import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { getSongBpmLookupTool } from "./getsongbpm.ts";
import { spotifyTrackLookupTool } from "./spotify.ts";

const model = new ChatOpenAI({
  model: "gpt-5-nano",
});

export const agent = createAgent({
  model,
  tools: [spotifyTrackLookupTool, getSongBpmLookupTool],
  systemPrompt: `You enrich music track metadata.

When the user provides a title and artists, call both lookup_spotify_track and lookup_getsongbpm_track before answering.
Use Spotify metadata for track identity and artist genres when available.
Use GetSongBPM for BPM/tempo.
Do not invent BPM. If GetSongBPM returns bpm as null, return BPM as null.

Always return only a JSON object with these exact keys:
{
  "BPM": number | null,
  "Genre": string | null,
  "AI_generated_summary": string,
  "Spotify": {
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
