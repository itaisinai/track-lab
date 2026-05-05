import { useEffect, useState, type FormEvent } from "react";
import {
  deleteSavedResult,
  listResults,
  reenrichSavedResult,
  runAgent,
  saveAgentResponse,
} from "../api/track-lab-api";
import { formatAgentResponse } from "../lib/format";
import { parseTrackDetails } from "../lib/track-details";
import { createTrackPrompt } from "../lib/track-prompt";
import type { SavedTrackResult, View } from "../types";
import { EnrichView } from "./EnrichView";
import { ResultDrawer } from "./ResultDrawer";
import { ResultsView } from "./ResultsView";
import "./App.css";

export function App() {
  const [view, setView] = useState<View>("enrich");
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
  const trackDetails = response ? parseTrackDetails(response) : null;

  useEffect(() => {
    void loadSavedResults();
  }, []);

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

    try {
      const data = await runAgent(createTrackPrompt(title.trim(), artists.trim()), {
        operation,
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
      setLastAgentResponse(data);
      setResponse(formatAgentResponse(data));
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Something went wrong"));
    } finally {
      setIsLoading(false);
    }
  }

  async function saveCurrentResponse() {
    if (!lastAgentResponse || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveMessage("");
    setError("");

    try {
      await saveAgentResponse(lastAgentResponse);
      setSaveMessage("Saved");
      await loadSavedResults();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Could not save result"));
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
    setShowSearchForm(false);

    try {
      const data = await reenrichSavedResult(result.id);
      setTitle(result.title);
      setArtists(result.artists);
      setLastAgentResponse(data);
      setResponse(formatAgentResponse(data));
      setView("enrich");
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

  return (
    <>
      <div className="page">
        <main className="page-content">
          <header className="topbar">
            <h1>Track Lab Agent</h1>
            <nav className="tabs" aria-label="Views">
              <button
                className={view === "enrich" ? "nav-tab active" : "nav-tab"}
                type="button"
                onClick={() => {
                  setView("enrich");
                  setShowSearchForm(true);
                }}
              >
                Analyze
              </button>
              <button
                className={view === "results" ? "nav-tab active" : "nav-tab"}
                type="button"
                onClick={() => {
                  setView("results");
                  void loadSavedResults();
                }}
              >
                Saved Results
              </button>
            </nav>
          </header>

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
              showSearchForm={showSearchForm}
              trackDetails={trackDetails}
              onTitleChange={setTitle}
              onArtistsChange={setArtists}
              onSubmit={submitPrompt}
              onEnrich={() => void runTrackAnalysis("enrich")}
              onSave={() => void saveCurrentResponse()}
            />
          ) : (
            <ResultsView
              results={results}
              error={resultsError}
              isLoading={isResultsLoading}
              reenrichingId={reenrichingId}
              onRefresh={() => void loadSavedResults()}
              onMore={openDrawer}
              onReenrich={(result) => void reenrichResult(result)}
              onDelete={(result) => void deleteResult(result)}
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
