import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { SavedTrackResult, TrackAnalysisJob } from "../../types";
import { formatDate, formatProviders } from "../../lib/format";
import { ArtistHoverChips } from "../../shared/components/ArtistHoverChips";
import { ArrowPathIcon } from "../../shared/icons/ArrowPathIcon";
import { DataTable } from "../../shared/components/DataTable";
import { EyeIcon } from "../../shared/icons/EyeIcon";
import { ProviderIconLink } from "../enrichment/ProviderIconLink";
import { TrashIcon } from "../../shared/icons/TrashIcon";
import "./ResultsView.css";

type ResultsViewProps = {
  results: SavedTrackResult[];
  error: string;
  isLoading: boolean;
  reenrichingId: number | null;
  activeJobs: TrackAnalysisJob[];
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
  activeJobs,
  onRefresh,
  onMore,
  onReenrich,
  onDelete,
}: ResultsViewProps) {
  const columns = useMemo<ColumnDef<SavedTrackResult>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
      },
      {
        accessorKey: "artists",
        header: "Artists",
        cell: ({ row }) => <ArtistHoverChips artists={row.original.artists} />,
      },
      {
        accessorKey: "album",
        header: "Album",
        cell: ({ getValue }) => (getValue<string | null>() ?? "N/A"),
      },
      {
        accessorKey: "bpm",
        header: "BPM",
        cell: ({ getValue }) => (getValue<number | null>() ?? "N/A"),
      },
      {
        accessorKey: "genre",
        header: "Genre",
        cell: ({ getValue }) => (getValue<string | null>() ?? "N/A"),
      },
      {
        accessorKey: "subGenre",
        header: "Subgenre",
        cell: ({ getValue }) => (getValue<string | null>() ?? "N/A"),
      },
      {
        accessorKey: "key",
        header: "Key",
        cell: ({ getValue }) => (getValue<string | null>() ?? "N/A"),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (result) => getResultStatus(result, activeJobs),
        cell: ({ row }) => {
          const status = getResultStatus(row.original, activeJobs);

          return <span className={`pill ${status}`}>{status}</span>;
        },
      },
      {
        id: "providers",
        header: "Providers",
        accessorFn: (result) => formatProviders(result.toolsUsed),
        cell: ({ row }) => <ProviderIconsCell result={row.original} />,
      },
      {
        id: "errors",
        header: "Errors",
        accessorFn: (result) => result.errors.length,
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ getValue }) => formatDate(getValue<string>()),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const result = row.original;

          return (
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
          );
        },
      },
    ],
    [activeJobs, onDelete, onMore, onReenrich, reenrichingId],
  );

  return (
    <section className="results-view">
      <div className="section-header">
        <h2>Saved Results</h2>
        <button className="secondary" type="button" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <DataTable
        data={results}
        columns={columns}
        emptyMessage={isLoading ? "Loading saved results..." : "No saved results yet."}
        getRowKey={(result) => result.id}
        searchPlaceholder="Search saved results"
      />
    </section>
  );
}

function ProviderIconsCell({ result }: { result: SavedTrackResult }) {
  if (result.toolsUsed.length === 0) {
    return "N/A";
  }

  return (
    <div className="provider-icons-cell">
      {result.toolsUsed.map((provider) => (
        <ProviderIconLink key={provider.name} provider={provider} />
      ))}
    </div>
  );
}

function getResultStatus(
  result: SavedTrackResult,
  activeJobs: TrackAnalysisJob[],
) {
  return (
    activeJobs.find(
      (job) =>
        job.operation === "enrich" &&
        job.payload.operation === "enrich" &&
        job.payload.source === "saved_result" &&
        job.payload.track.title === result.title &&
        job.payload.track.artists === result.artists,
    )?.status ?? result.status
  );
}
