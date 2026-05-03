import type { SavedTrackResult } from "../types";
import { valueToString } from "../lib/format";
import { TrackDetailsView } from "./TrackDetailsView";
import "./ResultDrawer.css";

type ResultDrawerProps = {
  result: SavedTrackResult;
  state: "opening" | "open" | "closing";
  onClose: () => void;
  onDelete: (result: SavedTrackResult) => void;
};

export function ResultDrawer({
  result,
  state,
  onClose,
  onDelete,
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
              result.toolsUsed.find((tool) => tool.name === "Spotify")?.url ??
              undefined,
            toolsUsed: result.toolsUsed,
            errors: result.errors,
          }}
        />

        <h3>Returned JSON</h3>
        <pre>{JSON.stringify(result.json, null, 2)}</pre>
      </div>
    </aside>
  );
}
