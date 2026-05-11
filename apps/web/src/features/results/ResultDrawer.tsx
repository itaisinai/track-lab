import type { SavedTrackResult, TrackDetails } from "../../types";
import { valueToString } from "../../lib/format";
import { TrackDetailsView } from "../enrichment/TrackDetailsView";
import "./ResultDrawer.css";

type ResultDrawerProps = {
  result: SavedTrackResult;
  state: "opening" | "open" | "closing";
  isEnriching: boolean;
  isSearchingRemixes: boolean;
  onClose: () => void;
  onEnrich: (result: SavedTrackResult) => void;
  onDelete: (result: SavedTrackResult) => void;
  onSearchRemixes: (result: SavedTrackResult) => void;
};

export function ResultDrawer({
  result,
  state,
  isEnriching,
  isSearchingRemixes,
  onClose,
  onEnrich,
  onDelete,
  onSearchRemixes,
}: ResultDrawerProps) {
  return (
    <aside
      className={`drawer ${state}`}
      aria-label="Result details"
      onClick={onClose}
    >
      <div className="drawer-panel" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h2>{result.title}</h2>
            <p>{result.artists}</p>
          </div>
          <div className="drawer-actions">
            <button
              className="secondary compact"
              type="button"
              disabled={isSearchingRemixes}
              onClick={() => onSearchRemixes(result)}
            >
              {isSearchingRemixes ? "Queueing..." : "Search remixes"}
            </button>
            <button
              className="secondary compact"
              type="button"
              disabled={isEnriching}
              onClick={() => onEnrich(result)}
            >
              {isEnriching ? "Enriching..." : "Enrich"}
            </button>
            <button
              className="danger compact"
              type="button"
              onClick={() => onDelete(result)}
            >
              Remove
            </button>
            <button className="secondary compact" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <TrackDetailsView
          details={{
            title: result.title,
            artists: result.artists,
            album: result.album ?? undefined,
            bpm: valueToString(result.bpm),
            genre: result.genre ?? undefined,
            subGenre: result.subGenre ?? undefined,
            key: result.key ?? undefined,
            summary: result.summary ?? undefined,
            spotifyUrl:
              result.toolsUsed.find((provider) => provider.name === "Spotify")
                ?.url ??
              undefined,
            toolsUsed: result.toolsUsed,
            changedFields: getChangedFields(result.json),
            errors: result.errors,
          }}
        />

        <h3>Returned JSON</h3>
        <pre>{JSON.stringify(result.json, null, 2)}</pre>
      </div>
    </aside>
  );
}

function getChangedFields(value: unknown): TrackDetails["changedFields"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const changedFields = (value as Record<string, unknown>).changedFields;
  if (!Array.isArray(changedFields)) {
    return undefined;
  }

  const allowedFields = new Set([
    "album",
    "bpm",
    "genre",
    "subGenre",
    "key",
    "spotifyUrl",
  ]);
  const fields = changedFields
    .filter((field): field is string => typeof field === "string")
    .filter((field) => allowedFields.has(field));

  return fields.length > 0
    ? (fields as NonNullable<TrackDetails["changedFields"]>)
    : undefined;
}
