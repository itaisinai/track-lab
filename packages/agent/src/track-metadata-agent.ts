import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { enrichTrackMetadataTool } from "./tools/enrich-track-metadata.ts";

const model = new ChatOpenAI({
  model: "gpt-5-nano",
});

export const agent = createAgent({
  model,
  tools: [enrichTrackMetadataTool],
  systemPrompt: `You enrich music track metadata.

When the user provides a track name and optional artist, call enrich_track_metadata.
Do not call provider-specific lookup tools directly.
Do not invent BPM or genre.

Always return only the JSON object produced by enrich_track_metadata:
{
  "trackName": string,
  "artist"?: string,
  "album"?: string | null,
  "spotifyUrl"?: string | null,
  "bpm": number | null,
  "genre": string | null,
  "key"?: string | null,
  "sources": {
    "bpm"?: "local_db" | "rekordbox_xml" | "audio_analysis" | "spotify" | "getsongbpm" | "lastfm" | "unknown",
    "genre"?: "local_db" | "rekordbox_xml" | "spotify" | "getsongbpm" | "lastfm" | "unknown",
    "album"?: "local_db" | "spotify" | "getsongbpm" | "unknown",
    "key"?: "local_db" | "rekordbox_xml" | "unknown"
  },
  "confidence": object,
  "status": "complete" | "partial" | "missing",
  "errors"?: string[]
}`,
});
