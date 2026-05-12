import { createPortal } from "react-dom";
import type { RemixSearchCandidate } from "../../types";
import type { DrawerState } from "../../shared/hooks/useResultDrawer";
import { formatDate } from "../../lib/format";
import "../results/ResultDrawer.css";
import "./RemixSearchView.css";

type RemixCandidateDrawerProps = {
  candidate: RemixSearchCandidate;
  state: DrawerState;
  isSaved: boolean;
  onClose: () => void;
};

export function RemixCandidateDrawer({
  candidate,
  state,
  isSaved,
  onClose,
}: RemixCandidateDrawerProps) {
  const tags = getCandidateTags(candidate);

  return createPortal(
    <aside
      className={`drawer ${state}`}
      aria-label="Remix details"
      onClick={onClose}
    >
      <div className="drawer-panel" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h2>{candidate.title}</h2>
            <p>{candidate.artists}</p>
            {isSaved && <span className="pill complete">Saved</span>}
          </div>
          <div className="drawer-actions">
            <a
              className="button secondary compact"
              href={candidate.link}
              target="_blank"
              rel="noreferrer"
            >
              Open
            </a>
            <button className="secondary compact" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="remix-candidate-details">
          <DetailField label="Provider" value={candidate.provider} />
          <DetailField label="Remix Artist" value={candidate.remixArtist} />
          <DetailField label="Album" value={candidate.album} />
          <DetailField label="Genre" value={candidate.genre} />
          <DetailField label="Subgenre" value={candidate.subGenre} />
          <DetailField label="BPM" value={candidate.bpm} />
          <DetailField
            label="Uploaded At"
            value={candidate.createdAt ? formatDate(candidate.createdAt) : null}
          />
          <DetailField
            label="Duration"
            value={formatDuration(candidate.durationMs)}
          />
          <DetailField label="Confidence" value={`${candidate.confidence}%`} />
          <DetailField label="Reason" value={candidate.relevanceReason} wide />
        </div>

        <h3>Tags</h3>
        {tags.length ? (
          <div className="remix-tags">
            {tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : (
          <p className="muted-text">No tags returned.</p>
        )}

        <h3>Full Candidate</h3>
        <pre>{JSON.stringify(candidate, null, 2)}</pre>
      </div>
    </aside>,
    document.body,
  );
}

type DetailFieldProps = {
  label: string;
  value: unknown;
  wide?: boolean;
};

function DetailField({ label, value, wide = false }: DetailFieldProps) {
  return (
    <div className={wide ? "detail-field wide" : "detail-field"}>
      <span>{label}</span>
      <strong>{formatDetailValue(value)}</strong>
    </div>
  );
}

function formatDetailValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  return String(value);
}

function formatDuration(value: number | null | undefined) {
  if (!value) {
    return null;
  }

  const totalSeconds = Math.round(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getCandidateTags(candidate: RemixSearchCandidate) {
  return Array.from(
    new Set(
      [candidate.genre, ...parseTags(candidate.subGenre)]
        .map((tag) => tag?.trim())
        .filter((tag): tag is string => Boolean(tag)),
    ),
  );
}

function parseTags(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return Array.from(value.matchAll(/"([^"]+)"|(\S+)/g))
    .map((match) => match[1] ?? match[2] ?? "")
    .filter(Boolean);
}
