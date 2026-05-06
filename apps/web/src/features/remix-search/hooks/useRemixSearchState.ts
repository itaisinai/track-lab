import { useState, type FormEvent } from "react";
import type { RemixSearchResponse } from "../../../types";
import { useRemixSearchMutation } from "../../../api/mutations/useRemixSearchMutation";
import { getErrorMessage } from "../../../lib/errors/app-errors";

export function useRemixSearchState() {
  const mutation = useRemixSearchMutation();
  const [title, setTitle] = useState("");
  const [artists, setArtists] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [genre, setGenre] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<RemixSearchResponse | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      const data = await mutation.mutateAsync({
        title: title.trim() || null,
        artists: artists.trim() || null,
        spotifyUrl: spotifyUrl.trim() || null,
        genre: genre.trim() || null,
      });
      setResult(data);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Could not search remixes"));
    }
  }

  return {
    artists,
    error,
    genre,
    isSearching: mutation.isPending,
    result,
    spotifyUrl,
    title,
    setArtists,
    setGenre,
    setSpotifyUrl,
    setTitle,
    submit,
  };
}
