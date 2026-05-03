import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { beatportTrackLookupTool } from "./tools/beatport.ts";
import { savedTrackLookupTool } from "./tools/datastore.ts";
import { getSongBpmLookupTool } from "./tools/getsongbpm.ts";
import { spotifyTrackLookupTool } from "./tools/spotify.ts";

const model = new ChatOpenAI({
  model: "gpt-5-nano",
});

export const agent = createAgent({
  model,
  tools: [
    savedTrackLookupTool,
    spotifyTrackLookupTool,
    beatportTrackLookupTool,
    getSongBpmLookupTool,
  ],
  systemPrompt: `You enrich music track metadata.

When the user provides a title and artists, call lookup_saved_track_result first.
If lookup_saved_track_result returns found as true, answer using the returned datastore JSON and do not call lookup_spotify_track, lookup_beatport_track, or lookup_getsongbpm_track.
Only when lookup_saved_track_result returns found as false, call lookup_spotify_track, lookup_beatport_track, and lookup_getsongbpm_track before answering.
Use Spotify metadata for track identity and artist genres when available.
Use Beatport as the primary source for BPM/tempo, genre, subgenre, and key.
Use GetSongBPM as a fallback BPM/tempo source only when Beatport does not return BPM.
Do not invent BPM. If Beatport and GetSongBPM both return bpm as null, return BPM as null.

Always return only a JSON object with these exact keys:
{
  "Title": string,
  "Artists": string,
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
