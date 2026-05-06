import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { RemixSearchCandidate } from "../../types";
import { DataTable } from "../../shared/components/DataTable";
import { formatDate } from "../../lib/format";
import { useRemixSearchState } from "./hooks/useRemixSearchState";
import "./RemixSearchView.css";

export function RemixSearchView() {
  const search = useRemixSearchState();
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
        accessorKey: "subGenre",
        header: "Subgenre",
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
        accessorKey: "link",
        header: "Link",
        enableSorting: false,
        cell: ({ row }) => (
          <a href={row.original.link} target="_blank" rel="noreferrer">
            Open
          </a>
        ),
      },
    ],
    [],
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
        <button type="submit" disabled={search.isSearching}>
          {search.isSearching ? "Searching..." : "Search Remixes"}
        </button>
      </form>

      {search.error && <p className="error-text">{search.error}</p>}

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
            data={search.result.candidates}
            columns={columns}
            emptyMessage="No remix candidates found."
            getRowKey={(candidate) => `${candidate.provider}-${candidate.link}`}
            minWidth={1320}
            searchPlaceholder="Search remix candidates"
            initialSorting={[{ id: "createdAt", desc: true }]}
          />
        </div>
      )}
    </section>
  );
}
