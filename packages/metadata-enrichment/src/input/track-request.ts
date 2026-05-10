export type TrackRequest = {
  title: string;
  artists: string;
};

export function parseTrackRequest(message: string): TrackRequest | null {
  const title = matchField(message, "Title");
  const artists = matchField(message, "Artists") ?? matchField(message, "Artist");

  if (!title || !artists) {
    return null;
  }

  return {
    title,
    artists,
  };
}

function matchField(message: string, field: string) {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = message.match(new RegExp(`^\\s*${escapedField}\\s*:\\s*(.+)$`, "im"));
  return match?.[1].trim() || null;
}
