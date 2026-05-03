import type { SavedTrackResult } from "../types";
import { valueToString } from "../lib/format";
import { TrackDetailsView } from "./TrackDetailsView";
import "./ResultDrawer.css";

type ResultDrawerProps = {
  result: SavedTrackResult;
  onClose: () => void;
};

export function ResultDrawer({ result, onClose }: ResultDrawerProps) {
  return (
    <aside className="drawer" aria-label="Result details">
      <div className="drawer-panel">
        <div className="drawer-header">
          <div>
            <h2>{result.title}</h2>
            <p>{result.artists}</p>
          </div>
          <button className="secondary compact" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <TrackDetailsView
          details={{
            title: result.title,
            artists: result.artists,
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
