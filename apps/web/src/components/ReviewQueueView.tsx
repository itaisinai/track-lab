import { formatDate } from "../lib/format";
import type { TrackAnalysisJob } from "../types";
import "./ResultsView.css";

type ReviewQueueViewProps = {
  jobs: TrackAnalysisJob[];
  notifications: TrackAnalysisJob[];
  error: string;
  onRefresh: () => void;
  onOpen: (job: TrackAnalysisJob) => void;
  onRetry: (job: TrackAnalysisJob) => void;
  onDismiss: (job: TrackAnalysisJob) => void;
};

export function ReviewQueueView({
  jobs,
  notifications,
  error,
  onRefresh,
  onOpen,
  onRetry,
  onDismiss,
}: ReviewQueueViewProps) {
  return (
    <section className="results-view">
      <div className="section-header">
        <h2>Review Queue</h2>
        <button className="secondary" type="button" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {notifications.length > 0 && (
        <div className="notification-list">
          {notifications.map((job) => (
            <button
              className="notification-item"
              type="button"
              key={job.id}
              onClick={() => onOpen(job)}
            >
              #{job.id} {job.operation} {job.status}: {job.payload.track.title}
            </button>
          ))}
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Operation</th>
              <th>Title</th>
              <th>Artists</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Completed</th>
              <th>Error</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>#{job.id}</td>
                <td>{job.operation}</td>
                <td>{job.payload.track.title}</td>
                <td>{job.payload.track.artists}</td>
                <td>
                  <span className={`pill ${job.status}`}>{job.status}</span>
                </td>
                <td>
                  {job.attemptCount}/{job.maxAttempts}
                </td>
                <td>{job.completedAt ? formatDate(job.completedAt) : "N/A"}</td>
                <td>{job.errorMessage ?? "N/A"}</td>
                <td>
                  <div className="row-actions">
                    <button type="button" onClick={() => onOpen(job)}>
                      Open
                    </button>
                    {(job.status === "failed" || job.status === "dead_lettered") && (
                      <button
                        className="secondary"
                        type="button"
                        onClick={() => onRetry(job)}
                      >
                        Retry
                      </button>
                    )}
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => onDismiss(job)}
                    >
                      Dismiss
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={9}>No jobs need review.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
