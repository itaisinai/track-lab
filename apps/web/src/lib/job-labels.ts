import type { TrackAnalysisJob } from "../types";

const DASH_VARIANTS = /[\u2010-\u2015\u2212]/g;
const ARTIST_TITLE_SEPARATOR = /\s+-\s+/;

export function formatJobTrackLabel(job: TrackAnalysisJob) {
  if (job.payload.operation === "remix_search") {
    const title = job.payload.request.title;
    const artists = job.payload.request.artists;
    const spotifyUrl = job.payload.request.spotifyUrl ? "Spotify link" : null;
    return [title, artists].filter(Boolean).join(" - ") || spotifyUrl || "Remix search";
  }

  return humanizeTrackLabel(
    job.payload.track.title,
    getPrimaryArtist(job.payload.track.artists),
  );
}

export function humanizeTrackLabel(title: string, artist?: string | null) {
  const cleanTitle = normalizeDash(title);
  const cleanArtist = normalizeDash(artist ?? "");

  if (!cleanArtist || ARTIST_TITLE_SEPARATOR.test(cleanTitle)) {
    return cleanTitle;
  }

  return `${cleanTitle} - ${cleanArtist}`;
}

function getPrimaryArtist(artists: string) {
  return artists
    .split(",")
    .map((artist) => artist.trim())
    .filter(Boolean)[0];
}

function normalizeDash(value: string) {
  return value.replace(DASH_VARIANTS, "-").replace(/\s+/g, " ").trim();
}
