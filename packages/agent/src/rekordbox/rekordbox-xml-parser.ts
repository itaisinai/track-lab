import { readFile } from "node:fs/promises";
import { parseRekordboxNumber } from "./rekordbox-normalization.ts";
import type { RekordboxTrackMetadata } from "./types.ts";

export async function loadRekordboxTracks(
  rekordboxXmlPath: string,
): Promise<RekordboxTrackMetadata[]> {
  const xml = await readFile(rekordboxXmlPath, "utf8");
  return parseRekordboxTracks(xml);
}

export function parseRekordboxTracks(xml: string): RekordboxTrackMetadata[] {
  const tracks: RekordboxTrackMetadata[] = [];
  const trackPattern = /<TRACK\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = trackPattern.exec(xml))) {
    const attributes = parseAttributes(match[1] ?? "");
    const trackName =
      attributes.Name ?? attributes.TrackName ?? attributes.Title ?? "";

    if (!trackName.trim()) {
      continue;
    }

    tracks.push({
      trackName,
      artist: attributes.Artist,
      bpm: parseRekordboxNumber(attributes.AverageBpm ?? attributes.Tempo),
      genre: attributes.Genre ?? null,
      key: attributes.Tonality ?? attributes.Key ?? null,
      location: attributes.Location ?? null,
    });
  }

  return tracks;
}

function parseAttributes(value: string) {
  const attributes: Record<string, string> = {};
  const attributePattern = /([A-Za-z_][\w:.-]*)="([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = attributePattern.exec(value))) {
    attributes[match[1]] = decodeXmlEntities(match[2]);
  }

  return attributes;
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
