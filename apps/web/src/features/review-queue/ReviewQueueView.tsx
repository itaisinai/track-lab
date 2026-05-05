import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "../../lib/format";
import type { TrackAnalysisJob } from "../../types";
import { DataTable } from "../../shared/components/DataTable";
import "../results/ResultsView.css";

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
  const columns = useMemo<ColumnDef<TrackAnalysisJob>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Job",
        cell: ({ getValue }) => `#${getValue<number>()}`,
      },
      {
        accessorKey: "operation",
        header: "Operation",
      },
      {
        id: "title",
        header: "Title",
        accessorFn: (job) => job.payload.track.title,
      },
      {
        id: "artists",
        header: "Artists",
        accessorFn: (job) => job.payload.track.artists,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span className={`pill ${row.original.status}`}>
            {row.original.status}
          </span>
        ),
      },
      {
        id: "attempts",
        header: "Attempts",
        accessorFn: (job) => `${job.attemptCount}/${job.maxAttempts}`,
      },
      {
        accessorKey: "completedAt",
        header: "Completed",
        cell: ({ getValue }) => {
          const completedAt = getValue<string | null>();
          return completedAt ? formatDate(completedAt) : "N/A";
        },
      },
      {
        accessorKey: "errorMessage",
        header: "Error",
        cell: ({ getValue }) => getValue<string | null>() ?? "N/A",
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const job = row.original;

          return (
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
          );
        },
      },
    ],
    [onDismiss, onOpen, onRetry],
  );

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

      <DataTable
        data={jobs}
        columns={columns}
        emptyMessage="No jobs need review."
        getRowKey={(job) => job.id}
        searchPlaceholder="Search review queue"
      />
    </section>
  );
}
