import type {
  ProviderTrackLookupResult,
  TrackLookupInput,
} from "../shared/types.ts";
import type {
  TrackMetadataProvider,
  TrackMetadataProviderInput,
  TrackMetadataProviderResult,
} from "../base/types.ts";
import {
  getTrackArtists,
  getTrackString,
  hasUsefulTrackLookupResult,
} from "../shared/provider-result-utils.ts";
import { logProviderSearch } from "../shared/utils.ts";
import { normalizeTrackLookupInput } from "../shared/track-query.ts";
import {
  getSpotifyAccessToken,
  getSpotifyArtists,
  getSpotifyTrackGenres,
  hasSpotifyCredentials,
  searchSpotifyTrack,
} from "./metadata-utils.ts";

export function createSpotifyMetadataProvider(): TrackMetadataProvider {
  return {
    name: "Spotify",
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

  const result = await lookupSpotifyTrack({ title: trackName, artists: artist });

  if (!hasUsefulTrackLookupResult(result)) {
    return null;
  }

  return {
    bpm: result.bpm,
    genre: result.genre,
    tags: result.genres,
    album: getTrackString(result.track, "album"),
    url: result.url ?? getTrackString(result.track, "spotifyUrl"),
    matchedTrack: {
      title: getTrackString(result.track, "title"),
      artists: getTrackArtists(result.track),
    },
    source: "spotify",
    confidence: 0.65,
    raw: result,
  };
}

export async function lookupSpotifyTrack({
  title,
  artists,
}: TrackLookupInput): Promise<ProviderTrackLookupResult> {
  const input = normalizeTrackLookupInput(title, artists);
  logProviderSearch("spotify", "search started", {
    title: input.title,
    artists: input.artists,
  });

  if (!hasSpotifyCredentials()) {
    logProviderSearch("spotify", "skipped missing credentials");
    return {
      found: false,
      source: "spotify",
      bpm: null,
      genre: null,
      genres: [],
      url: null,
      track: null,
      note: "Spotify credentials are not configured.",
    };
  }

  try {
    const token = await getSpotifyAccessToken();
    const track = await searchSpotifyTrack(token, input.title, input.artists);

    if (!track) {
      logProviderSearch("spotify", "no match", {
        title: input.title,
        artists: input.artists,
      });
      return {
        found: false,
        source: "spotify",
        bpm: null,
        genre: null,
        url: null,
        note: "No matching Spotify track found.",
      };
    }

    const genres = getSpotifyTrackGenres(
      await getSpotifyArtists(
        token,
        track.artists.map((artist) => artist.id),
      ).catch(() => []),
    );

    logProviderSearch("spotify", "matched track", {
      title: track.name,
      artists: track.artists.map((artist) => artist.name).join(", "),
      genre: genres[0] ?? null,
      url: track.external_urls?.spotify ?? null,
    });

    return {
      found: true,
      source: "spotify",
      bpm: null,
      genre: genres[0] ?? null,
      genres,
      url: track.external_urls?.spotify ?? null,
      track: {
        id: track.id,
        title: track.name,
        artists: track.artists.map((artist) => artist.name),
        artistGenres: genres,
        album: track.album?.name ?? null,
        releaseDate: track.album?.release_date ?? null,
        spotifyUrl: track.external_urls?.spotify ?? null,
        uri: track.uri,
        imageUrl: track.album?.images?.[0]?.url ?? null,
      },
    };
  } catch (error) {
    logProviderSearch("spotify", "search failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      found: false,
      source: "spotify",
      bpm: null,
      genre: null,
      genres: [],
      url: null,
      track: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
