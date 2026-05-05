import type { TrackAnalysisPayload } from "@track-lab/api-types";

export function createTrackAnalysisPrompt(payload: TrackAnalysisPayload) {
  const lines = [
    "I have a track and I want you to enrich the details:",
    `Title: ${payload.track.title}`,
    `Artist: ${payload.track.artists}`,
    "",
  ];

  if (payload.operation === "enrich" && payload.knownMetadata) {
    lines.push("Known metadata:");
    appendKnownMetadata(lines, payload.knownMetadata);
    lines.push("");
  }

  lines.push(
    "I want you to send back object with:",
    "Title, Artists, Album, BPM, Genre, SubGenre, Key, AI-generated summary, provider statuses, Spotify URL, Beatport URL, GetSongBPM URL, and Wikipedia URL when available",
  );

  return lines.join("\n");
}

function appendKnownMetadata(
  lines: string[],
  knownMetadata: NonNullable<TrackAnalysisPayload["knownMetadata"]>,
) {
  const fields = [
    ["Album", knownMetadata.album],
    ["BPM", knownMetadata.bpm],
    ["Genre", knownMetadata.genre],
    ["SubGenre", knownMetadata.subGenre],
    ["Key", knownMetadata.key],
    ["Spotify URL", knownMetadata.spotifyUrl],
  ] as const;

  for (const [label, value] of fields) {
    if (value !== null && value !== undefined && value !== "") {
      lines.push(`${label}: ${value}`);
    }
  }
}
