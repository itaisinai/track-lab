import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useSavedRemixesQuery } from "../../api/queries/useSavedRemixesQuery";
import type {
  SavedRemixCandidate,
  SavedTrackResult,
  TrackAnalysisJob,
} from "../../types";
import { formatDate, formatProviders } from "../../lib/format";
import { ArtistHoverChips } from "../../shared/components/ArtistHoverChips";
import { DataTable } from "../../shared/components/DataTable";
import { IconTooltipButton } from "../../shared/components/IconTooltipButton";
import { EyeIcon } from "../../shared/icons/EyeIcon";
import { ProviderIconLink } from "../enrichment/ProviderIconLink";
import { TrashIcon } from "../../shared/icons/TrashIcon";
import { RemixCandidatesTable } from "../saved-remixes/RemixCandidatesTable";
import trackLabEnrichIcon from "../../../assets/tracklab-enrich-icon.svg";
import trackLabRemixSearchIcon from "../../../assets/tracklab-remix-search-icon.svg";
import "./ResultsView.css";

type ResultsViewProps = {
  results: SavedTrackResult[];
  error: string;
  isLoading: boolean;
  reenrichingId: number | null;
  isSearchingRemixes: boolean;
  activeJobs: TrackAnalysisJob[];
  onRefresh: () => void;
  onMore: (result: SavedTrackResult) => void;
  onReenrich: (result: SavedTrackResult) => void;
  onDelete: (result: SavedTrackResult) => void;
  onSearchRemixes: (result: SavedTrackResult) => void;
};

export function ResultsView({
  results,
  error,
  isLoading,
  reenrichingId,
  isSearchingRemixes,
  activeJobs,
  onRefresh,
  onMore,
  onReenrich,
  onDelete,
  onSearchRemixes,
}: ResultsViewProps) {
  const savedRemixesQuery = useSavedRemixesQuery();
  const remixesByTrack = useMemo(
    () => groupRemixesByTrack(savedRemixesQuery.data ?? []),
    [savedRemixesQuery.data],
  );
  const columns = useMemo<ColumnDef<SavedTrackResult>[]>(
    () => [
      {
        id: "expand",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const remixCount = getRemixesForResult(row.original, remixesByTrack).length;

          if (remixCount === 0) {
            return null;
          }

          return (
            <button
              className="secondary compact"
              type="button"
              onClick={row.getToggleExpandedHandler()}
            >
              {row.getIsExpanded() ? "Hide" : "Show"}
            </button>
          );
        },
      },
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
        id: "remixes",
        header: "Remixes",
        accessorFn: (result) => getRemixesForResult(result, remixesByTrack).length,
        cell: ({ row }) => {
          const remixes = getRemixesForResult(row.original, remixesByTrack);

          return remixes.length > 0 ? `${remixes.length} saved` : "0";
        },
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
              <IconTooltipButton
                className="secondary"
                type="button"
                onClick={() => onMore(result)}
                label="View details"
                icon={<EyeIcon className="button-icon" />}
              />
              <IconTooltipButton
                className="secondary"
                type="button"
                disabled={reenrichingId === result.id}
                onClick={() => onReenrich(result)}
                label="Enrich again"
                icon={
                  <img
                    className={
                      reenrichingId === result.id
                        ? "button-icon large-action-icon spinning"
                        : "button-icon large-action-icon"
                    }
                    src={trackLabEnrichIcon}
                    alt=""
                    aria-hidden="true"
                  />
                }
              />
              <IconTooltipButton
                className="secondary"
                type="button"
                disabled={isSearchingRemixes}
                onClick={() => onSearchRemixes(result)}
                label="Search remixes"
                icon={
                  <img
                    className="button-icon large-action-icon"
                    src={trackLabRemixSearchIcon}
                    alt=""
                    aria-hidden="true"
                  />
                }
              />
              <IconTooltipButton
                className="danger"
                type="button"
                onClick={() => onDelete(result)}
                label="Remove"
                icon={<TrashIcon className="button-icon" />}
              />
            </div>
          );
        },
      },
    ],
    [
      activeJobs,
      isSearchingRemixes,
      onDelete,
      onMore,
      onReenrich,
      onSearchRemixes,
      reenrichingId,
      remixesByTrack,
    ],
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
      {savedRemixesQuery.error && (
        <p className="error-text">Could not load saved remixes.</p>
      )}

      <DataTable
        tableId="saved-results"
        data={results}
        columns={columns}
        emptyMessage={isLoading ? "Loading saved results..." : "No saved results yet."}
        getRowKey={(result) => result.id}
        searchPlaceholder="Search saved results"
        getRowCanExpand={(result) =>
          getRemixesForResult(result, remixesByTrack).length > 0
        }
        renderExpandedRow={(result) => {
          const remixes = getRemixesForResult(result, remixesByTrack);

          if (remixes.length === 0) {
            return null;
          }

          return <RemixCandidatesTable remixes={remixes} />;
        }}
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

function groupRemixesByTrack(remixes: SavedRemixCandidate[]) {
  const groups = new Map<string, SavedRemixCandidate[]>();

  for (const remix of remixes) {
    const key = buildTrackKey(remix.originalTrack.title, remix.originalTrack.artists);
    groups.set(key, [...(groups.get(key) ?? []), remix]);
  }

  return groups;
}

function getRemixesForResult(
  result: SavedTrackResult,
  remixesByTrack: Map<string, SavedRemixCandidate[]>,
) {
  return remixesByTrack.get(buildTrackKey(result.title, result.artists)) ?? [];
}

function buildTrackKey(title: string, artists: string) {
  return `${title.trim().toLowerCase()}::${artists.trim().toLowerCase()}`;
}
