import { useState } from "react";
import { formatAgentResponse } from "../../../lib/format";
import { parseTrackDetails } from "../../../lib/track-details";
import type { TrackAnalysisJob } from "../../../types";

export function useReviewDraftState() {
  const [title, setTitle] = useState("");
  const [artists, setArtists] = useState("");
  const [response, setResponse] = useState("");
  const [showSearchForm, setShowSearchForm] = useState(true);
  const [lastAgentResponse, setLastAgentResponse] = useState<unknown>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [error, setError] = useState("");
  const [currentReviewJobId, setCurrentReviewJobId] = useState<number | null>(
    null,
  );
  const trackDetails = response ? parseTrackDetails(response) : null;

  function loadJobIntoReview(job: TrackAnalysisJob) {
    setTitle(job.payload.track.title);
    setArtists(job.payload.track.artists);
    setShowSearchForm(false);
    setLastAgentResponse(job.status === "completed" ? job.result : null);
    setCurrentReviewJobId(job.id);
    setResponse(job.result ? formatAgentResponse(job.result) : "");
    setError(job.errorMessage ?? "");
    setSaveMessage("");
  }

  function clearCurrentReviewState() {
    setCurrentReviewJobId(null);
    setLastAgentResponse(null);
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
    lastAgentResponse,
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
    setLastAgentResponse,
    setResponse,
    setSaveMessage,
    setShowSearchForm,
    setTitle,
  };
}
