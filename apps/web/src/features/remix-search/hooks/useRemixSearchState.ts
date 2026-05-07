import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import type { RemixSearchResponse, TrackAnalysisJob } from "../../../types";
import { useRemixSearchMutation } from "../../../api/mutations/useRemixSearchMutation";
import { request } from "../../../api/request";
import { apiRoutes } from "../../../api/routes";
import { getErrorMessage } from "../../../lib/errors/app-errors";

export function useRemixSearchState(initialJobId: number | null = null) {
  const mutation = useRemixSearchMutation();
  const [title, setTitle] = useState("");
  const [artists, setArtists] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [genre, setGenre] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<RemixSearchResponse | null>(null);
  const [jobId, setJobId] = useState<number | null>(initialJobId);
  const jobQuery = useQuery({
    queryKey: ["remix-search-job", jobId],
    queryFn: () => getTrackAnalysisJob(jobId as number),
    enabled: jobId !== null,
    refetchInterval: (query) => {
      const job = query.state.data;
      return job && (job.status === "queued" || job.status === "processing")
        ? 1500
        : false;
    },
  });

  useEffect(() => {
    setJobId(initialJobId);
    setError("");
    setResult(null);
  }, [initialJobId]);

  useEffect(() => {
    const job = jobQuery.data;

    if (!job) {
      return;
    }

    if (job.status === "completed") {
      setResult(job.result as RemixSearchResponse);
      return;
    }

    if (job.status === "failed" || job.status === "dead_lettered") {
      setError(job.errorMessage ?? "Could not search remixes");
    }
  }, [jobQuery.data]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);

    try {
      const data = await mutation.mutateAsync({
        title: title.trim() || null,
        artists: artists.trim() || null,
        spotifyUrl: spotifyUrl.trim() || null,
        genre: genre.trim() || null,
      });
      setJobId(data.job.id);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Could not search remixes"));
    }
  }

  function clear() {
    setTitle("");
    setArtists("");
    setSpotifyUrl("");
    setGenre("");
    setError("");
    setResult(null);
    setJobId(null);
    mutation.reset();
  }

  const activeJob = jobQuery.data;
  const isJobActive =
    activeJob?.status === "queued" || activeJob?.status === "processing";

  return {
    activeJob,
    artists,
    clear,
    error,
    genre,
    isEnqueueing: mutation.isPending,
    isSearching: jobQuery.isLoading || isJobActive,
    jobId,
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

async function getTrackAnalysisJob(id: number) {
  const data = await request<{ job: TrackAnalysisJob }>(
    apiRoutes.trackAnalysisJob(id),
  );
  return data.job;
}
