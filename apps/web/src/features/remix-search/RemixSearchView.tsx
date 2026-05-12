import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { RemixSearchCandidate } from "../../types";
import { useSaveRemixMutation } from "../../api/mutations/useSaveRemixMutation";
import { useSavedRemixesQuery } from "../../api/queries/useSavedRemixesQuery";
import { DataTable } from "../../shared/components/DataTable";
import { formatDate } from "../../lib/format";
import { useResultDrawer } from "../../shared/hooks/useResultDrawer";
import { ProviderIconLink } from "../enrichment/ProviderIconLink";
import { RemixCandidateDrawer } from "./RemixCandidateDrawer";
import { useRemixSearchState } from "./hooks/useRemixSearchState";
import "./RemixSearchView.css";

type RemixSearchViewProps = {
  jobId?: number | null;
};

export function RemixSearchView({ jobId = null }: RemixSearchViewProps) {
  const search = useRemixSearchState(jobId);
  const savedRemixesQuery = useSavedRemixesQuery();
  const saveRemixMutation = useSaveRemixMutation();
  const {
    closeDrawer,
    drawerState,
    openDrawer,
    selectedResult,
  } = useResultDrawer<RemixSearchCandidate>();
  const initialSorting = useMemo(
    () => [
      { id: "createdAt", desc: true },
      { id: "confidence", desc: true },
    ],
    [],
  );
  const savedRemixKeys = useMemo(
    () => new Set((savedRemixesQuery.data ?? []).map(getCandidateKey)),
    [savedRemixesQuery.data],
  );
  const columns = useMemo<ColumnDef<RemixSearchCandidate>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
      },
      {
        accessorKey: "artists",
        header: "Artists",
      },
      {
        accessorKey: "remixArtist",
        header: "Remix Artist",
        cell: ({ getValue }) => getValue<string | null>() ?? "N/A",
      },
      {
        accessorKey: "album",
        header: "Album",
        cell: ({ getValue }) => getValue<string | null>() ?? "N/A",
      },
      {
        accessorKey: "genre",
        header: "Genre",
        cell: ({ getValue }) => getValue<string | null>() ?? "N/A",
      },
      {
        accessorKey: "bpm",
        header: "BPM",
        cell: ({ getValue }) => getValue<number | null>() ?? "N/A",
      },
      {
        accessorKey: "provider",
        header: "Provider",
        cell: ({ row }) => (
          <ProviderIconLink
            provider={{
              name: row.original.provider,
              matched: true,
              url: row.original.link,
              error: null,
            }}
          />
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Uploaded At",
        sortingFn: "datetime",
        cell: ({ getValue }) => {
          const value = getValue<string | null>();
          return value ? formatDate(value) : "N/A";
        },
      },
      {
        accessorKey: "confidence",
        header: "Confidence",
        cell: ({ getValue }) => `${getValue<number>()}%`,
      },
      {
        id: "details",
        header: "Details",
        enableSorting: false,
        cell: ({ row }) => (
          <button
            className="secondary compact"
            type="button"
            onClick={() => openDrawer(row.original)}
          >
            Details
          </button>
        ),
      },
      {
        id: "save",
        header: "Save",
        enableSorting: false,
        cell: ({ row }) => {
          const isSaved = savedRemixKeys.has(getCandidateKey(row.original));

          if (isSaved) {
            return <span className="pill complete">Saved</span>;
          }

          return (
            <button
              className="secondary compact"
              type="button"
              disabled={!search.result || saveRemixMutation.isPending}
              onClick={() => {
                if (!search.result) {
                  return;
                }

                saveRemixMutation.mutate({
                  candidate: row.original,
                  originalTrack: search.result.originalTrack,
                  requestedGenre: search.result.requestedGenre ?? null,
                });
              }}
            >
              Save
            </button>
          );
        },
      },
    ],
    [openDrawer, saveRemixMutation, savedRemixKeys, search.result],
  );

  return (
    <section className="remix-search-view">
      <div className="section-header">
        <h2>Remix Search</h2>
      </div>

      <form className="remix-search-form" onSubmit={search.submit}>
        <label>
          <span>Spotify URL</span>
          <input
            value={search.spotifyUrl}
            onChange={(event) => search.setSpotifyUrl(event.target.value)}
            placeholder="https://open.spotify.com/track/..."
          />
        </label>
        <label>
          <span>Title</span>
          <input
            value={search.title}
            onChange={(event) => search.setTitle(event.target.value)}
            placeholder="Babatunde"
          />
        </label>
        <label>
          <span>Artists</span>
          <input
            value={search.artists}
            onChange={(event) => search.setArtists(event.target.value)}
            placeholder="Peekaboo, G-Rex"
          />
        </label>
        <label>
          <span>Genre</span>
          <input
            value={search.genre}
            onChange={(event) => search.setGenre(event.target.value)}
            placeholder="Optional, e.g. bass"
          />
        </label>
        <div className="remix-search-actions">
          <button type="submit" disabled={search.isEnqueueing}>
            {search.isEnqueueing ? "Queueing..." : "Search Remixes"}
          </button>
          <button
            className="secondary"
            type="button"
            onClick={() => {
              closeDrawer();
              search.clear();
            }}
          >
            Clear
          </button>
        </div>
      </form>

      {search.isSearching && (
        <div className="remix-search-loading" role="status" aria-live="polite">
          <span />
          <strong>
            {search.activeJob
              ? `#${search.activeJob.id} ${search.activeJob.status}`
              : "Queueing remix search"}
          </strong>
        </div>
      )}

      {search.error && <p className="error-text">{search.error}</p>}
      {saveRemixMutation.error && (
        <p className="error-text">Could not save remix.</p>
      )}

      {search.result && (
        <div className="remix-search-results">
          <div className="datastore-summary">
            <span>
              Original: {search.result.originalTrack.title} -{" "}
              {search.result.originalTrack.artists}
            </span>
            <span>Genre: {search.result.requestedGenre ?? "Any"}</span>
            <span>Matches: {search.result.candidates.length}</span>
          </div>
          <DataTable
            tableId="remix-search-results"
            data={search.result.candidates}
            columns={columns}
            emptyMessage="No remix candidates found."
            getRowKey={(candidate) => `${candidate.provider}-${candidate.link}`}
            minWidth={1280}
            searchPlaceholder="Search remix candidates"
            initialSorting={initialSorting}
          />
        </div>
      )}

      {selectedResult && (
        <RemixCandidateDrawer
          candidate={selectedResult}
          state={drawerState}
          isSaved={savedRemixKeys.has(getCandidateKey(selectedResult))}
          onClose={closeDrawer}
        />
      )}
    </section>
  );
}

function getCandidateKey(candidate: RemixSearchCandidate) {
  return `${candidate.provider}::${candidate.link.trim().toLowerCase()}`;
}
