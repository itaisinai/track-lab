import type { SavedTrackResult } from "../types";
import { formatDate, formatTools } from "../lib/format";
import "./ResultsView.css";

type ResultsViewProps = {
  results: SavedTrackResult[];
  error: string;
  isLoading: boolean;
  reenrichingId: number | null;
  onRefresh: () => void;
  onMore: (result: SavedTrackResult) => void;
  onReenrich: (result: SavedTrackResult) => void;
};

export function ResultsView({
  results,
  error,
  isLoading,
  reenrichingId,
  onRefresh,
  onMore,
  onReenrich,
}: ResultsViewProps) {
  return (
    <section className="results-view">
      <div className="section-header">
        <h2>Saved Results</h2>
        <button className="secondary" type="button" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Artists</th>
              <th>BPM</th>
              <th>Genre</th>
              <th>Subgenre</th>
              <th>Key</th>
              <th>Status</th>
              <th>Tools</th>
              <th>Errors</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.id}>
                <td>{result.title}</td>
                <td>{result.artists}</td>
                <td>{result.bpm ?? "Unknown"}</td>
                <td>{result.genre ?? "Unknown"}</td>
                <td>{result.subGenre ?? "Unknown"}</td>
                <td>{result.key ?? "Unknown"}</td>
                <td>
                  <span className={`pill ${result.status}`}>{result.status}</span>
                </td>
                <td>{formatTools(result.toolsUsed)}</td>
                <td>{result.errors.length}</td>
                <td>{formatDate(result.updatedAt)}</td>
                <td>
                  <div className="row-actions">
                    <button
                      className="secondary compact"
                      type="button"
                      onClick={() => onMore(result)}
                    >
                      More
                    </button>
                    <button
                      className="compact"
                      type="button"
                      disabled={reenrichingId === result.id}
                      onClick={() => onReenrich(result)}
                    >
                      {reenrichingId === result.id ? "Running..." : "Enrich"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && results.length === 0 && (
              <tr>
                <td colSpan={11}>No saved results yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
