export type TrackRequest = {
  title: string;
  artists: string;
  rekordboxXmlPath?: string;
  filePath?: string;
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
    rekordboxXmlPath: matchField(message, "Rekordbox XML Path") ?? undefined,
    filePath: matchField(message, "File Path") ?? undefined,
  };
}

function matchField(message: string, field: string) {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = message.match(new RegExp(`^\\s*${escapedField}\\s*:\\s*(.+)$`, "im"));
  return match?.[1].trim() || null;
}
