import type { FormEvent } from "react";
import type { TrackDetails } from "../types";
import { TrackDetailsView } from "./TrackDetailsView";
import "./EnrichView.css";

type EnrichViewProps = {
  title: string;
  artists: string;
  response: string;
  error: string;
  saveMessage: string;
  isLoading: boolean;
  isSaving: boolean;
  canSave: boolean;
  skipPersistedResults: boolean;
  trackDetails: TrackDetails | null;
  onTitleChange: (value: string) => void;
  onArtistsChange: (value: string) => void;
  onSkipPersistedResultsChange: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSave: () => void;
};

export function EnrichView({
  title,
  artists,
  response,
  error,
  saveMessage,
  isLoading,
  isSaving,
  canSave,
  skipPersistedResults,
  trackDetails,
  onTitleChange,
  onArtistsChange,
  onSkipPersistedResultsChange,
  onSubmit,
  onSave,
}: EnrichViewProps) {
  return (
    <>
      <form className="panel" onSubmit={onSubmit}>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Hot Honey"
        />

        <label htmlFor="artists">Artists</label>
        <input
          id="artists"
          value={artists}
          onChange={(event) => onArtistsChange(event.target.value)}
          placeholder="LIAD MEIR, Eden Derso"
        />
        <label className="toggle">
          <input
            type="checkbox"
            checked={skipPersistedResults}
            onChange={(event) =>
              onSkipPersistedResultsChange(event.target.checked)
            }
          />
          <span>
            <strong>Skip saved results</strong>
            <small>Force fresh enrichment from external sources.</small>
          </span>
        </label>
        <div className="actions">
          <button type="submit" disabled={isLoading || !title.trim() || !artists.trim()}>
            {isLoading ? "Sending..." : "Send"}
          </button>
          <button
            className="secondary"
            type="button"
            disabled={!canSave || isSaving}
            onClick={onSave}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
          {saveMessage && <span className="status-note">{saveMessage}</span>}
        </div>
      </form>

      {(response || error) && (
        <section className="response" aria-live="polite">
          {trackDetails && !error && <TrackDetailsView details={trackDetails} />}

          <h2>Full Response</h2>
          <pre>{error || response}</pre>
        </section>
      )}
    </>
  );
}
