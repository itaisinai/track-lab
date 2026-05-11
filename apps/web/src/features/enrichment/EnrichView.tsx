import { motion } from "framer-motion";
import type { FormEvent } from "react";
import type { TrackDetails } from "../../types";
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
  canDismiss: boolean;
  showSearchForm: boolean;
  trackDetails: TrackDetails | null;
  onTitleChange: (value: string) => void;
  onArtistsChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEnrich: () => void;
  onSave: () => void;
  onDismiss: () => void;
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
  canDismiss,
  showSearchForm,
  trackDetails,
  onTitleChange,
  onArtistsChange,
  onSubmit,
  onEnrich,
  onSave,
  onDismiss,
}: EnrichViewProps) {
  const hasTrack = Boolean(title.trim() && artists.trim());

  return (
    <motion.section
      className="analyze-card glass-card xl:col-span-7"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: "easeOut" }}
    >
      <div className="card-heading">
        <div>
          <span className="eyebrow">AI Metadata Engine</span>
          <h2>Analyze Track</h2>
        </div>
        {isLoading && <span className="live-pill active">Running</span>}
      </div>
      {showSearchForm && (
        <form className="panel analyze-form" onSubmit={onSubmit}>
          <p className="panel-copy">
            Enrich BPM, key, genre, provider evidence, and DJ-ready context
            with the Track Lab agent.
          </p>
          <label htmlFor="title">
            <span>Track Title</span>
            <div className="input-shell">
              <NoteIcon />
              <input
                id="title"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder="Hot Honey"
              />
            </div>
          </label>

          <label htmlFor="artists">
            <span>Artists</span>
            <div className="input-shell">
              <UserIcon />
              <input
                id="artists"
                value={artists}
                onChange={(event) => onArtistsChange(event.target.value)}
                placeholder="LIAD MEIR, Eden Derso"
              />
            </div>
          </label>
          <div className="actions">
            <button type="submit" disabled={isLoading || !hasTrack}>
              <WaveIcon />
              {isLoading ? "Analyzing signals..." : "Run AI Analysis"}
            </button>
            <button
              className="secondary"
              type="button"
              disabled={!canSave || isSaving}
              onClick={onSave}
            >
              {isSaving ? "Saving..." : "Save to Library"}
            </button>
            {saveMessage && <span className="status-note">{saveMessage}</span>}
          </div>
        </form>
      )}

      {(response || error) && (
        <section className="response" aria-live="polite">
          {trackDetails && !error && (
            <>
              <TrackDetailsView details={trackDetails} />
            </>
          )}

          {(trackDetails || canDismiss) && (
            <div className="actions response-actions">
              {trackDetails && !error && (
                <button
                  className="secondary"
                  type="button"
                  disabled={isLoading}
                  onClick={onEnrich}
                >
                  {isLoading ? "Enriching..." : "Re-run enrichment"}
                </button>
              )}
              {!showSearchForm && trackDetails && !error && (
                <button
                  type="button"
                  disabled={!canSave || isSaving}
                  onClick={onSave}
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              )}
              {canDismiss && (
                <button
                  className="secondary"
                  type="button"
                  disabled={isSaving}
                  onClick={onDismiss}
                >
                  Dismiss
                </button>
              )}
              {!showSearchForm && saveMessage && (
                <span className="status-note">{saveMessage}</span>
              )}
            </div>
          )}

          <h2>Full Response</h2>
          <pre>{error || response}</pre>
        </section>
      )}
    </motion.section>
  );
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 18V5l10-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="7" r="4" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12h3l2-7 4 14 3-9 2 2h4" />
    </svg>
  );
}
