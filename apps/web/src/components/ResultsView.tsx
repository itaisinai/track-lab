import type { SavedTrackResult } from "../types";
import { formatDate, formatTools } from "../lib/format";
import { ArtistHoverChips } from "./ArtistHoverChips";
import { ArrowPathIcon } from "./icons/ArrowPathIcon";
import { EyeIcon } from "./icons/EyeIcon";
import { TrashIcon } from "./icons/TrashIcon";
import "./ResultsView.css";

type ResultsViewProps = {
  results: SavedTrackResult[];
  error: string;
  isLoading: boolean;
  reenrichingId: number | null;
  onRefresh: () => void;
  onMore: (result: SavedTrackResult) => void;
  onReenrich: (result: SavedTrackResult) => void;
  onDelete: (result: SavedTrackResult) => void;
};

export function ResultsView({
  results,
  error,
  isLoading,
  reenrichingId,
  onRefresh,
  onMore,
  onReenrich,
  onDelete,
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
              <th>Album</th>
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
                <td>
                  <ArtistHoverChips artists={result.artists} />
                </td>
                <td>{result.album ?? "N/A"}</td>
                <td>{result.bpm ?? "N/A"}</td>
                <td>{result.genre ?? "N/A"}</td>
                <td>{result.subGenre ?? "N/A"}</td>
                <td>{result.key ?? "N/A"}</td>
                <td>
                  <span className={`pill ${result.status}`}>{result.status}</span>
                </td>
                <td>{formatTools(result.toolsUsed)}</td>
                <td>{result.errors.length}</td>
                <td>{formatDate(result.updatedAt)}</td>
                <td>
                  <div className="row-actions">
                    <button
                      className="icon-button secondary"
                      type="button"
                      aria-label={`View ${result.title}`}
                      title="View details"
                      onClick={() => onMore(result)}
                    >
                      <EyeIcon className="button-icon" />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Enrich ${result.title} again`}
                      title="Enrich again"
                      disabled={reenrichingId === result.id}
                      onClick={() => onReenrich(result)}
                    >
                      <ArrowPathIcon
                        className={
                          reenrichingId === result.id
                            ? "button-icon spinning"
                            : "button-icon"
                        }
                      />
                    </button>
                    <button
                      className="icon-button danger"
                      type="button"
                      aria-label={`Remove ${result.title}`}
                      title="Remove"
                      onClick={() => onDelete(result)}
                    >
                      <TrashIcon className="button-icon" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && results.length === 0 && (
              <tr>
                <td colSpan={12}>No saved results yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
