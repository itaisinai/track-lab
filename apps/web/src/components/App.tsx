import { useEffect, useState, type FormEvent } from "react";
import {
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

    await enrichWithMessage(createTrackPrompt(title.trim(), artists.trim()));
  }

  async function enrichWithMessage(message: string) {
    setIsLoading(true);
    setError("");
    setResponse("");
    setSaveMessage("");
    setLastAgentResponse(null);

    try {
      const data = await runAgent(message);
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

    try {
      const data = await reenrichSavedResult(result.id);
      setTitle(result.title);
      setArtists(result.artists);
      setLastAgentResponse(data);
      setResponse(formatAgentResponse(data));
      setView("enrich");
      setSelectedResult(null);
    } catch (caughtError) {
      setResultsError(getErrorMessage(caughtError, "Could not enrich result"));
    } finally {
      setReenrichingId(null);
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1>Track Lab Agent</h1>
        <nav className="tabs" aria-label="Views">
          <button
            className={view === "enrich" ? "tab active" : "tab"}
            type="button"
            onClick={() => setView("enrich")}
          >
            Enrich
          </button>
          <button
            className={view === "results" ? "tab active" : "tab"}
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
          trackDetails={trackDetails}
          onTitleChange={setTitle}
          onArtistsChange={setArtists}
          onSubmit={submitPrompt}
          onSave={() => void saveCurrentResponse()}
        />
      ) : (
        <ResultsView
          results={results}
          error={resultsError}
          isLoading={isResultsLoading}
          reenrichingId={reenrichingId}
          onRefresh={() => void loadSavedResults()}
          onMore={setSelectedResult}
          onReenrich={(result) => void reenrichResult(result)}
        />
      )}

      {selectedResult && (
        <ResultDrawer
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      )}
    </main>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
