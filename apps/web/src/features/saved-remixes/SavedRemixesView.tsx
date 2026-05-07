import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { SavedRemixCandidate } from "../../types";
import { useSavedRemixesQuery } from "../../api/queries/useSavedRemixesQuery";
import { formatDate } from "../../lib/format";
import { DataTable } from "../../shared/components/DataTable";
import { useResultDrawer } from "../../shared/hooks/useResultDrawer";
import { ProviderIconLink } from "../enrichment/ProviderIconLink";
import { RemixCandidateDrawer } from "../remix-search/RemixCandidateDrawer";
import "../results/ResultsView.css";

type SavedRemixGroup = {
  id: string;
  title: string;
  artists: string;
  requestedGenre: string | null;
  remixCount: number;
  latestSavedAt: string;
  latestUploadedAt: string | null;
  remixes: SavedRemixCandidate[];
};

export function SavedRemixesView() {
  const savedRemixesQuery = useSavedRemixesQuery();
  const {
    closeDrawer,
    drawerState,
    openDrawer,
    selectedResult,
  } = useResultDrawer<SavedRemixCandidate>();
  const groups = useMemo(
    () => groupSavedRemixes(savedRemixesQuery.data ?? []),
    [savedRemixesQuery.data],
  );
  const columns = useMemo<ColumnDef<SavedRemixGroup>[]>(
    () => [
      {
        id: "expand",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <button
            className="secondary compact"
            type="button"
            onClick={row.getToggleExpandedHandler()}
          >
            {row.getIsExpanded() ? "Hide" : "Show"}
          </button>
        ),
      },
      {
        accessorKey: "title",
        header: "Title",
      },
      {
        accessorKey: "artists",
        header: "Artists",
      },
      {
        accessorKey: "requestedGenre",
        header: "Genre",
        cell: ({ getValue }) => getValue<string | null>() ?? "Any",
      },
      {
        accessorKey: "remixCount",
        header: "Remixes",
      },
      {
        accessorKey: "latestUploadedAt",
        header: "Latest Uploaded",
        sortingFn: "datetime",
        cell: ({ getValue }) => {
          const value = getValue<string | null>();
          return value ? formatDate(value) : "N/A";
        },
      },
      {
        accessorKey: "latestSavedAt",
        header: "Latest Saved",
        sortingFn: "datetime",
        cell: ({ getValue }) => formatDate(getValue<string>()),
      },
    ],
    [],
  );

  return (
    <section className="results-view">
      <div className="section-header">
        <h2>Saved Remixes</h2>
        <button
          className="secondary"
          type="button"
          onClick={() => void savedRemixesQuery.refetch()}
        >
          Refresh
        </button>
      </div>

      {savedRemixesQuery.error && (
        <p className="error-text">Could not load saved remixes.</p>
      )}

      <DataTable
        data={groups}
        columns={columns}
        emptyMessage={
          savedRemixesQuery.isLoading
            ? "Loading saved remixes..."
            : "No saved remixes yet."
        }
        getRowKey={(group) => group.id}
        getRowCanExpand={(group) => group.remixes.length > 0}
        renderExpandedRow={(group) => (
          <SavedRemixChildrenTable group={group} onOpen={openDrawer} />
        )}
        minWidth={1120}
        searchPlaceholder="Search saved remixes"
        initialSorting={[{ id: "latestSavedAt", desc: true }]}
      />

      {selectedResult && (
        <RemixCandidateDrawer
          candidate={selectedResult}
          state={drawerState}
          onClose={closeDrawer}
        />
      )}
    </section>
  );
}

function SavedRemixChildrenTable({
  group,
  onOpen,
}: {
  group: SavedRemixGroup;
  onOpen: (remix: SavedRemixCandidate) => void;
}) {
  return (
    <table className="nested-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Artists</th>
          <th>Remix Artist</th>
          <th>Genre</th>
          <th>Provider</th>
          <th>Uploaded At</th>
          <th>Confidence</th>
          <th>Saved At</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        {group.remixes.map((remix) => (
          <tr key={remix.id}>
            <td>{remix.title}</td>
            <td>{remix.artists}</td>
            <td>{remix.remixArtist ?? "N/A"}</td>
            <td>{remix.genre ?? "N/A"}</td>
            <td>
              <ProviderIconLink
                provider={{
                  name: remix.provider,
                  matched: true,
                  url: remix.link,
                  error: null,
                }}
              />
            </td>
            <td>{remix.createdAt ? formatDate(remix.createdAt) : "N/A"}</td>
            <td>{remix.confidence}%</td>
            <td>{formatDate(remix.savedAt)}</td>
            <td>
              <button
                className="secondary compact"
                type="button"
                onClick={() => onOpen(remix)}
              >
                Details
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function groupSavedRemixes(remixes: SavedRemixCandidate[]): SavedRemixGroup[] {
  const groups = new Map<string, SavedRemixCandidate[]>();

  for (const remix of remixes) {
    const key = [
      remix.originalTrack.title.trim().toLowerCase(),
      remix.originalTrack.artists.trim().toLowerCase(),
      remix.requestedGenre?.trim().toLowerCase() ?? "",
    ].join("::");
    groups.set(key, [...(groups.get(key) ?? []), remix]);
  }

  return Array.from(groups.entries()).map(([id, groupRemixes]) => {
    const [first] = groupRemixes;
    const sortedRemixes = [...groupRemixes].sort(
      (left, right) =>
        Date.parse(right.savedAt) - Date.parse(left.savedAt),
    );

    return {
      id,
      title: `${first.originalTrack.title} Remixes`,
      artists: first.originalTrack.artists,
      requestedGenre: first.requestedGenre ?? null,
      remixCount: sortedRemixes.length,
      latestSavedAt: sortedRemixes[0].savedAt,
      latestUploadedAt: getLatestUploadedAt(sortedRemixes),
      remixes: sortedRemixes,
    };
  });
}

function getLatestUploadedAt(remixes: SavedRemixCandidate[]) {
  const timestamps = remixes
    .map((remix) => remix.createdAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left));

  return timestamps[0] ?? null;
}
