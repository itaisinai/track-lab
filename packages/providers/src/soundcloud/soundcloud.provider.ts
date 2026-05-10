import type {
  TrackMetadataProvider,
  TrackMetadataProviderInput,
  TrackMetadataProviderResult,
} from "../base/types.ts";
import { logProviderSearch } from "../shared/utils.ts";
import {
  createTitleFirstTrackQueries,
  normalizeTrackLookupInput,
} from "../shared/track-query.ts";
import { searchSoundCloudWebTracks } from "./web-search.ts";

export function createSoundCloudMetadataProvider(): TrackMetadataProvider {
  return {
    name: "SoundCloud",
    lookup(input: TrackMetadataProviderInput) {
      return lookupTrackMetadata(input);
    },
  };
}

async function lookupTrackMetadata({
  trackName,
  artist,
}: TrackMetadataProviderInput): Promise<TrackMetadataProviderResult | null> {
  if (!artist) {
    return null;
  }
  const input = normalizeTrackLookupInput(trackName, artist);

  logProviderSearch("soundcloud", "metadata search started", {
    title: input.title,
    artists: input.artists,
  });
  const candidates = await searchSoundCloudWebTracks(
    {
      queries: createSoundCloudTrackQueries(input.title, input.artists),
      genre: null,
    },
    {
      logger(message, details) {
        logProviderSearch("soundcloud", message, details);
      },
    },
  );
  const match = candidates.find((candidate) => candidate.link);

  if (!match) {
    logProviderSearch("soundcloud", "metadata no match", {
      title: input.title,
      artists: input.artists,
    });
    return null;
  }

  logProviderSearch("soundcloud", "metadata matched track", {
    title: match.title,
    artists: match.artists,
    genre: match.genre ?? null,
    url: match.link,
  });

  return {
    bpm: match.bpm ?? null,
    genre: match.genre ?? null,
    subGenre: match.subGenre ?? null,
    tags: getTags(match.subGenre),
    url: match.link,
    matchedTrack: {
      title: match.title,
      artists: match.artists,
    },
    source: "soundcloud",
    confidence: 0.55,
    raw: match,
  };
}

function createSoundCloudTrackQueries(trackName: string, artist: string) {
  return createTitleFirstTrackQueries(trackName, artist);
}

function getTags(value: string | null | undefined) {
  return value
    ?.split(/\s+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}
