import { formatDate } from "../lib/format";
import type { SavedTrackResult, TrackAnalysisJob } from "../types";
import "./ResultsView.css";

type DataStoreViewProps = {
  jobs: TrackAnalysisJob[];
  results: SavedTrackResult[];
  error: string;
  onRefresh: () => void;
};

export function DataStoreView({
  jobs,
  results,
  error,
  onRefresh,
}: DataStoreViewProps) {
  return (
    <section className="results-view">
      <div className="section-header">
        <h2>Data Store</h2>
        <button className="secondary" type="button" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="datastore-summary">
        <span>track_analysis_jobs: {jobs.length}</span>
        <span>track_results: {results.length}</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Operation</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Payload</th>
              <th>Result</th>
              <th>Error</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>#{job.id}</td>
                <td>{job.operation}</td>
                <td>
                  <span className={`pill ${job.status}`}>{job.status}</span>
                </td>
                <td>
                  {job.attemptCount}/{job.maxAttempts}
                </td>
                <td>
                  <pre className="table-json">{formatJson(job.payload)}</pre>
                </td>
                <td>
                  <pre className="table-json">{formatJson(job.result)}</pre>
                </td>
                <td>{job.errorMessage ?? "N/A"}</td>
                <td>{formatDate(job.updatedAt)}</td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={8}>No queue jobs yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatJson(value: unknown) {
  if (value === null || value === undefined) {
    return "null";
  }

  return JSON.stringify(value, null, 2);
}
