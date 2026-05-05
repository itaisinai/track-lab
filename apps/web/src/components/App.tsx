import { useEffect, useState, type FormEvent } from "react";
import {
  deleteSavedResult,
  getTrackAnalysisJob,
  listTrackAnalysisJobs,
  listResults,
  markTrackAnalysisNotificationRead,
  reenrichSavedResult,
  resolveTrackAnalysisJob,
  retryTrackAnalysisJob,
  runAgent,
  saveAgentResponse,
} from "../api/track-lab-api";
import { formatAgentResponse } from "../lib/format";
import { parseTrackDetails } from "../lib/track-details";
import { createTrackPrompt } from "../lib/track-prompt";
import type { SavedTrackResult, TrackAnalysisJob, View } from "../types";
import { DataStoreView } from "./DataStoreView";
import { EnrichView } from "./EnrichView";
import { ResultDrawer } from "./ResultDrawer";
import { ResultsView } from "./ResultsView";
import { ReviewQueueView } from "./ReviewQueueView";
import "./App.css";

export function App() {
  const initialRoute = getRouteFromPath(window.location.pathname);
  const [view, setView] = useState<View>(initialRoute.view);
  const [title, setTitle] = useState("");
  const [artists, setArtists] = useState("");
  const [response, setResponse] = useState("");
  const [showSearchForm, setShowSearchForm] = useState(true);
  const [lastAgentResponse, setLastAgentResponse] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState<SavedTrackResult[]>([]);
  const [resultsError, setResultsError] = useState("");
  const [isResultsLoading, setIsResultsLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SavedTrackResult | null>(
    null,
  );
  const [drawerState, setDrawerState] = useState<
    "opening" | "open" | "closing"
  >("opening");
  const [reenrichingId, setReenrichingId] = useState<number | null>(null);
  const [activeJobs, setActiveJobs] = useState<TrackAnalysisJob[]>([]);
  const [reviewJobs, setReviewJobs] = useState<TrackAnalysisJob[]>([]);
  const [notificationJobs, setNotificationJobs] = useState<TrackAnalysisJob[]>([]);
  const [allJobs, setAllJobs] = useState<TrackAnalysisJob[]>([]);
  const [jobsError, setJobsError] = useState("");
  const [currentReviewJobId, setCurrentReviewJobId] = useState<number | null>(null);
  const trackDetails = response ? parseTrackDetails(response) : null;

  useEffect(() => {
    void loadSavedResults();
    void refreshJobs();
    void applyRoute(getRouteFromPath(window.location.pathname), { replace: true });

    function handlePopState() {
      void applyRoute(getRouteFromPath(window.location.pathname), { replace: true });
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    const activeInterval = window.setInterval(() => {
      void refreshJobs();
    }, activeJobs.length > 0 ? 1000 : 2000);
    const notificationInterval = window.setInterval(() => {
      void refreshJobs();
    }, 7000);

    return () => {
      window.clearInterval(activeInterval);
      window.clearInterval(notificationInterval);
    };
  }, [activeJobs.length]);

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim() || !artists.trim() || isLoading) {
      return;
    }

    await runTrackAnalysis("analyze");
  }

  async function runTrackAnalysis(operation: "analyze" | "enrich") {
    if (!title.trim() || !artists.trim() || isLoading) {
      return;
    }

    setIsLoading(true);
    if (operation === "analyze") {
      setShowSearchForm(true);
    }
    setError("");
    setResponse("");
    setSaveMessage("");
    setLastAgentResponse(null);
    setCurrentReviewJobId(null);

    try {
      const data = await runAgent(createTrackPrompt(title.trim(), artists.trim()), {
        operation,
        track: {
          title: title.trim(),
          artists: artists.trim(),
        },
        skipPersistedResults: operation === "enrich",
        knownMetadata:
          operation === "enrich" && trackDetails
            ? {
                album: trackDetails.album ?? null,
                bpm: trackDetails.bpm ? Number(trackDetails.bpm) : null,
                genre: trackDetails.genre ?? null,
                subGenre: trackDetails.subGenre ?? null,
                key: trackDetails.key ?? null,
                spotifyUrl: trackDetails.spotifyUrl ?? null,
              }
            : undefined,
      });
      setResponse(`Queued ${operation} job #${data.job.id}.`);
      navigateToView("review");
      await refreshJobs();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Something went wrong"));
    } finally {
      setIsLoading(false);
    }
  }

  async function saveCurrentResponse() {
    if (!lastAgentResponse || isSaving) {
      return false;
    }

    setIsSaving(true);
    setSaveMessage("");
    setError("");

    try {
      await saveAgentResponse(lastAgentResponse);
      setSaveMessage("Saved");
      await loadSavedResults();
      return true;
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Could not save result"));
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function loadSavedResults() {
    setIsResultsLoading(true);
    setResultsError("");

    try {
      setResults(await listResults());
    } catch (caughtError) {
      setResultsError(getErrorMessage(caughtError, "Could not load results"));
    } finally {
      setIsResultsLoading(false);
    }
  }

  async function reenrichResult(result: SavedTrackResult) {
    setReenrichingId(result.id);
    setError("");
    setSaveMessage("");

    try {
      await reenrichSavedResult(result.id);
      navigateToView("review");
      await refreshJobs();
      closeDrawer();
    } catch (caughtError) {
      setResultsError(getErrorMessage(caughtError, "Could not enrich result"));
    } finally {
      setReenrichingId(null);
    }
  }

  async function deleteResult(result: SavedTrackResult) {
    const shouldDelete = window.confirm(
      `Remove "${result.title}" by ${result.artists}?`,
    );

    if (!shouldDelete) {
      return;
    }

    setResultsError("");

    try {
      await deleteSavedResult(result.id);
      setResults((currentResults) =>
        currentResults.filter((currentResult) => currentResult.id !== result.id),
      );

      if (selectedResult?.id === result.id) {
        closeDrawer();
      }
    } catch (caughtError) {
      setResultsError(getErrorMessage(caughtError, "Could not remove result"));
    }
  }

  function openDrawer(result: SavedTrackResult) {
    setDrawerState("opening");
    setSelectedResult(result);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setDrawerState("open");
      });
    });
  }

  function closeDrawer() {
    if (!selectedResult || drawerState === "closing") {
      return;
    }

    setDrawerState("closing");
    window.setTimeout(() => {
      setSelectedResult(null);
      setDrawerState("opening");
    }, 260);
  }

  async function refreshJobs() {
    await Promise.all([
      refreshActiveJobs(),
      refreshNotifications(),
      refreshReviewJobs(),
      refreshAllJobs(),
    ]);
  }

  async function refreshActiveJobs() {
    try {
      setActiveJobs(
        await listTrackAnalysisJobs({ statuses: ["queued", "processing"] }),
      );
      setJobsError("");
    } catch (caughtError) {
      setJobsError(getErrorMessage(caughtError, "Could not load active jobs"));
    }
  }

  async function refreshNotifications() {
    try {
      setNotificationJobs(await listTrackAnalysisJobs({ unread: true }));
      setJobsError("");
    } catch (caughtError) {
      setJobsError(getErrorMessage(caughtError, "Could not load notifications"));
    }
  }

  async function refreshReviewJobs() {
    try {
      setReviewJobs(await listTrackAnalysisJobs({ unresolved: true }));
      setJobsError("");
    } catch (caughtError) {
      setJobsError(getErrorMessage(caughtError, "Could not load review queue"));
    }
  }

  async function refreshAllJobs() {
    try {
      setAllJobs(await listTrackAnalysisJobs());
      setJobsError("");
    } catch (caughtError) {
      setJobsError(getErrorMessage(caughtError, "Could not load datastore"));
    }
  }

  async function openJob(job: TrackAnalysisJob) {
    if (!job.notificationReadAt) {
      setNotificationJobs((currentJobs) =>
        currentJobs.filter((currentJob) => currentJob.id !== job.id),
      );
      await markTrackAnalysisNotificationRead(job.id);
    }

    setTitle(job.payload.track.title);
    setArtists(job.payload.track.artists);
    setShowSearchForm(false);
    setLastAgentResponse(job.status === "completed" ? job.result : null);
    setCurrentReviewJobId(job.id);
    setResponse(job.result ? formatAgentResponse(job.result) : "");
    setError(job.errorMessage ?? "");
    setSaveMessage("");
    navigateToJob(job.id);
    await refreshJobs();
  }

  async function retryJob(job: TrackAnalysisJob) {
    try {
      await retryTrackAnalysisJob(job.id);
      await refreshJobs();
    } catch (caughtError) {
      setJobsError(getErrorMessage(caughtError, "Could not retry job"));
    }
  }

  async function resolveJob(job: TrackAnalysisJob) {
    try {
      await resolveTrackAnalysisJob(job.id);
      await refreshJobs();
    } catch (caughtError) {
      setJobsError(getErrorMessage(caughtError, "Could not resolve job"));
    }
  }

  async function dismissCurrentJob() {
    if (!currentReviewJobId) {
      return;
    }

    const currentJob =
      reviewJobs.find((job) => job.id === currentReviewJobId) ??
      allJobs.find((job) => job.id === currentReviewJobId);

    if (!currentJob) {
      return;
    }

    await resolveJob(currentJob);
    setCurrentReviewJobId(null);
    setLastAgentResponse(null);
    setResponse("");
    setError("");
    setSaveMessage("Dismissed");
    navigateToView("review");
  }

  async function applyRoute(
    route: AppRoute,
    options: { replace?: boolean } = {},
  ) {
    if (route.path !== window.location.pathname) {
      updateHistory(route.path, options.replace ?? false);
    }

    setView(route.view);

    if (route.view === "enrich" && !route.jobId) {
      setShowSearchForm(true);
      setCurrentReviewJobId(null);
      return;
    }

    if (route.view === "results") {
      await loadSavedResults();
      return;
    }

    if (route.view === "review") {
      await refreshReviewJobs();
      return;
    }

    if (route.view === "datastore") {
      await Promise.all([refreshAllJobs(), loadSavedResults()]);
      return;
    }

    if (route.jobId) {
      await openJobFromRoute(route.jobId);
    }
  }

  async function openJobFromRoute(jobId: number) {
    try {
      const job = await getTrackAnalysisJob(jobId);

      if (!job.notificationReadAt) {
        setNotificationJobs((currentJobs) =>
          currentJobs.filter((currentJob) => currentJob.id !== job.id),
        );
        await markTrackAnalysisNotificationRead(job.id);
      }

      setTitle(job.payload.track.title);
      setArtists(job.payload.track.artists);
      setShowSearchForm(false);
      setLastAgentResponse(job.status === "completed" ? job.result : null);
      setCurrentReviewJobId(job.id);
      setResponse(job.result ? formatAgentResponse(job.result) : "");
      setError(job.errorMessage ?? "");
      setSaveMessage("");
      setView("enrich");
      await refreshJobs();
    } catch (caughtError) {
      setJobsError(getErrorMessage(caughtError, "Could not open review job"));
      navigateToView("review", { replace: true });
    }
  }

  function navigateToView(
    nextView: View,
    options: { replace?: boolean } = {},
  ) {
    setView(nextView);
    updateHistory(getPathForView(nextView), options.replace ?? false);
  }

  function navigateToJob(jobId: number) {
    updateHistory(`/review/jobs/${jobId}`, false);
  }

  async function saveAndResolveCurrentJob() {
    const saved = await saveCurrentResponse();

    if (saved && currentReviewJobId) {
      const currentJob = reviewJobs.find((job) => job.id === currentReviewJobId);

      if (currentJob) {
        await resolveJob(currentJob);
      }
    }
  }

  return (
    <>
      <div className="page">
        <main className="page-content">
          <header className="topbar">
            <h1>Track Lab Agent</h1>
            <nav className="tabs" aria-label="Views">
              <button
                className={
                  view === "enrich" && !currentReviewJobId
                    ? "nav-tab active"
                    : "nav-tab"
                }
                type="button"
                onClick={() => {
                  setShowSearchForm(true);
                  navigateToView("enrich");
                }}
              >
                Analyze
              </button>
              <button
                className={view === "results" ? "nav-tab active" : "nav-tab"}
                type="button"
                onClick={() => {
                  navigateToView("results");
                  void loadSavedResults();
                }}
              >
                Saved Results
              </button>
              <button
                className={
                  view === "review" || currentReviewJobId
                    ? "nav-tab active"
                    : "nav-tab"
                }
                type="button"
                onClick={() => {
                  navigateToView("review");
                  void refreshReviewJobs();
                }}
              >
                Review Queue
              </button>
              <button
                className={view === "datastore" ? "nav-tab active" : "nav-tab"}
                type="button"
                onClick={() => {
                  navigateToView("datastore");
                  void Promise.all([refreshAllJobs(), loadSavedResults()]);
                }}
              >
                Data Store
              </button>
            </nav>
            <button
              className="notification-button"
              type="button"
              onClick={() => {
                navigateToView("review");
                void refreshJobs();
              }}
            >
              Notifications {notificationJobs.length}
            </button>
          </header>

          {(activeJobs.length > 0 || jobsError) && (
            <section className="job-strip" aria-live="polite">
              {jobsError && <span className="error-text">{jobsError}</span>}
              {activeJobs.map((job) => (
                <span className={`pill ${job.status}`} key={job.id}>
                  #{job.id} {job.operation} {job.status}: {formatJobTrackLabel(job)}
                </span>
              ))}
            </section>
          )}

          {view === "enrich" ? (
            <EnrichView
              title={title}
              artists={artists}
              response={response}
              error={error}
              saveMessage={saveMessage}
              isLoading={isLoading}
              isSaving={isSaving}
              canSave={Boolean(lastAgentResponse)}
              canDismiss={Boolean(currentReviewJobId)}
              showSearchForm={showSearchForm}
              trackDetails={trackDetails}
              onTitleChange={setTitle}
              onArtistsChange={setArtists}
              onSubmit={submitPrompt}
              onEnrich={() => void runTrackAnalysis("enrich")}
              onSave={() => void saveAndResolveCurrentJob()}
              onDismiss={() => void dismissCurrentJob()}
            />
          ) : view === "results" ? (
            <ResultsView
              results={results}
              error={resultsError}
              isLoading={isResultsLoading}
              reenrichingId={reenrichingId}
              activeJobs={activeJobs}
              onRefresh={() => void loadSavedResults()}
              onMore={openDrawer}
              onReenrich={(result) => void reenrichResult(result)}
              onDelete={(result) => void deleteResult(result)}
            />
          ) : view === "review" ? (
            <ReviewQueueView
              jobs={reviewJobs}
              notifications={notificationJobs}
              error={jobsError}
              onRefresh={() => void refreshJobs()}
              onOpen={(job) => void openJob(job)}
              onRetry={(job) => void retryJob(job)}
              onDismiss={(job) => void resolveJob(job)}
            />
          ) : (
            <DataStoreView
              jobs={allJobs}
              results={results}
              error={jobsError}
              onRefresh={() => void Promise.all([refreshAllJobs(), loadSavedResults()])}
            />
          )}
        </main>
      </div>

      {selectedResult && (
        <ResultDrawer
          result={selectedResult}
          state={drawerState}
          isEnriching={reenrichingId === selectedResult.id}
          onClose={closeDrawer}
          onEnrich={(result) => void reenrichResult(result)}
          onDelete={(result) => void deleteResult(result)}
        />
      )}
    </>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type AppRoute = {
  view: View;
  path: string;
  jobId?: number;
};

function getRouteFromPath(pathname: string): AppRoute {
  const normalizedPath = normalizePath(pathname);
  const reviewJobMatch = normalizedPath.match(/^\/review\/jobs\/(\d+)$/);

  if (reviewJobMatch) {
    return {
      view: "enrich",
      path: normalizedPath,
      jobId: Number(reviewJobMatch[1]),
    };
  }

  if (normalizedPath === "/results") {
    return { view: "results", path: normalizedPath };
  }

  if (normalizedPath === "/review") {
    return { view: "review", path: normalizedPath };
  }

  if (normalizedPath === "/datastore") {
    return { view: "datastore", path: normalizedPath };
  }

  return { view: "enrich", path: "/analyze" };
}

function getPathForView(view: View) {
  if (view === "results") {
    return "/results";
  }

  if (view === "review") {
    return "/review";
  }

  if (view === "datastore") {
    return "/datastore";
  }

  return "/analyze";
}

function normalizePath(pathname: string) {
  if (!pathname || pathname === "/") {
    return "/analyze";
  }

  return pathname.replace(/\/+$/, "") || "/analyze";
}

function updateHistory(path: string, replace: boolean) {
  if (window.location.pathname === path) {
    return;
  }

  if (replace) {
    window.history.replaceState(null, "", path);
    return;
  }

  window.history.pushState(null, "", path);
}

function formatJobTrackLabel(job: TrackAnalysisJob) {
  const title = job.payload.track.title;
  const artists = job.payload.track.artists
    .split(",")
    .map((artist) => artist.trim())
    .filter(Boolean);
  const artistLabel = artists.length > 1 ? `${artists[0]}...` : artists[0];

  return [title, artistLabel].filter(Boolean).join(" - ");
}
