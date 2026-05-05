import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "../../lib/format";
import type { SavedTrackResult, TrackAnalysisJob } from "../../types";
import { DataTable } from "../../shared/components/DataTable";
import "../results/ResultsView.css";

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
        id: "payload",
        header: "Payload",
        accessorFn: (job) => JSON.stringify(job.payload),
        cell: ({ row }) => (
          <pre className="table-json">{formatJson(row.original.payload)}</pre>
        ),
      },
      {
        id: "result",
        header: "Result",
        accessorFn: (job) => JSON.stringify(job.result),
        cell: ({ row }) => (
          <pre className="table-json">{formatJson(row.original.result)}</pre>
        ),
      },
      {
        accessorKey: "errorMessage",
        header: "Error",
        cell: ({ getValue }) => getValue<string | null>() ?? "N/A",
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ getValue }) => formatDate(getValue<string>()),
      },
    ],
    [],
  );

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

      <DataTable
        data={jobs}
        columns={columns}
        emptyMessage="No queue jobs yet."
        getRowKey={(job) => job.id}
        searchPlaceholder="Search queue jobs"
        minWidth={1280}
      />
    </section>
  );
}

function formatJson(value: unknown) {
  if (value === null || value === undefined) {
    return "null";
  }

  return JSON.stringify(value, null, 2);
}
