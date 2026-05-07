import type {
  ProviderTrackLookupResult,
  TrackLookupInput,
} from "../shared/types.ts";
import { logProviderSearch } from "../shared/utils.ts";
import {
  getSpotifyAccessToken,
  getSpotifyArtists,
  getSpotifyTrackGenres,
  hasSpotifyCredentials,
  searchSpotifyTrack,
} from "./metadata-utils.ts";

export async function lookupSpotifyTrack({
  title,
  artists,
}: TrackLookupInput): Promise<ProviderTrackLookupResult> {
  logProviderSearch("spotify", "search started", { title, artists });

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
    const track = await searchSpotifyTrack(token, title, artists);

    if (!track) {
      logProviderSearch("spotify", "no match", { title, artists });
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
