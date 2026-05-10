import { useState } from "react";
import { formatEnrichmentResponse } from "../../../lib/format";
import { parseTrackDetails } from "../../../lib/track-details";
import type { TrackAnalysisJob } from "../../../types";

export function useReviewDraftState() {
  const [title, setTitle] = useState("");
  const [artists, setArtists] = useState("");
  const [response, setResponse] = useState("");
  const [showSearchForm, setShowSearchForm] = useState(true);
  const [lastEnrichmentResponse, setLastEnrichmentResponse] = useState<unknown>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [error, setError] = useState("");
  const [currentReviewJobId, setCurrentReviewJobId] = useState<number | null>(
    null,
  );
  const trackDetails = response ? parseTrackDetails(response) : null;

  function loadJobIntoReview(job: TrackAnalysisJob) {
    if (job.payload.operation === "remix_search") {
      return;
    }

    setTitle(job.payload.track.title);
    setArtists(job.payload.track.artists);
    setShowSearchForm(false);
    setLastEnrichmentResponse(job.status === "completed" ? job.result : null);
    setCurrentReviewJobId(job.id);
    setResponse(job.result ? formatEnrichmentResponse(job.result) : "");
    setError(job.errorMessage ?? "");
    setSaveMessage("");
  }

  function clearCurrentReviewState() {
    setCurrentReviewJobId(null);
    setLastEnrichmentResponse(null);
    setResponse("");
    setError("");
    setTitle("");
    setArtists("");
    setShowSearchForm(true);
  }

  return {
    artists,
    currentReviewJobId,
    error,
    lastEnrichmentResponse,
    response,
    saveMessage,
    showSearchForm,
    title,
    trackDetails,
    clearCurrentReviewState,
    loadJobIntoReview,
    setArtists,
    setCurrentReviewJobId,
    setError,
    setLastEnrichmentResponse,
    setResponse,
    setSaveMessage,
    setShowSearchForm,
    setTitle,
  };
}
