import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { RemixSearchCandidate } from "../../types";
import { DataTable } from "../../shared/components/DataTable";
import { formatDate } from "../../lib/format";
import { useRemixSearchState } from "./hooks/useRemixSearchState";
import "../results/ResultDrawer.css";
import "./RemixSearchView.css";

export function RemixSearchView() {
  const search = useRemixSearchState();
  const [selectedCandidate, setSelectedCandidate] =
    useState<RemixSearchCandidate | null>(null);
  const initialSorting = useMemo(
    () => [
      { id: "createdAt", desc: true },
      { id: "confidence", desc: true },
    ],
    [],
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
      {
        id: "details",
        header: "Details",
        enableSorting: false,
        cell: ({ row }) => (
          <button
            className="secondary compact"
            type="button"
            onClick={() => setSelectedCandidate(row.original)}
          >
            Details
          </button>
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
        <div className="remix-search-actions">
          <button type="submit" disabled={search.isSearching}>
            {search.isSearching ? "Searching..." : "Search Remixes"}
          </button>
          <button
            className="secondary"
            type="button"
            disabled={search.isSearching}
            onClick={() => {
              setSelectedCandidate(null);
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
          <strong>Searching remixes</strong>
        </div>
      )}

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
            minWidth={1420}
            searchPlaceholder="Search remix candidates"
            initialSorting={initialSorting}
          />
        </div>
      )}

      {selectedCandidate && (
        <RemixCandidateDrawer
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
        />
      )}
    </section>
  );
}

type RemixCandidateDrawerProps = {
  candidate: RemixSearchCandidate;
  onClose: () => void;
};

function RemixCandidateDrawer({
  candidate,
  onClose,
}: RemixCandidateDrawerProps) {
  const tags = getCandidateTags(candidate);

  return (
    <aside className="drawer open" aria-label="Remix details" onClick={onClose}>
      <div className="drawer-panel" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h2>{candidate.title}</h2>
            <p>{candidate.artists}</p>
          </div>
          <div className="drawer-actions">
            <a
              className="button secondary compact"
              href={candidate.link}
              target="_blank"
              rel="noreferrer"
            >
              Open
            </a>
            <button className="secondary compact" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="remix-candidate-details">
          <DetailField label="Provider" value={candidate.provider} />
          <DetailField label="Remix Artist" value={candidate.remixArtist} />
          <DetailField label="Album" value={candidate.album} />
          <DetailField label="Genre" value={candidate.genre} />
          <DetailField label="Subgenre" value={candidate.subGenre} />
          <DetailField label="BPM" value={candidate.bpm} />
          <DetailField
            label="Uploaded At"
            value={candidate.createdAt ? formatDate(candidate.createdAt) : null}
          />
          <DetailField
            label="Duration"
            value={formatDuration(candidate.durationMs)}
          />
          <DetailField label="Confidence" value={`${candidate.confidence}%`} />
          <DetailField label="Reason" value={candidate.relevanceReason} wide />
        </div>

        <h3>Tags</h3>
        {tags.length ? (
          <div className="remix-tags">
            {tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : (
          <p className="muted-text">No tags returned.</p>
        )}

        <h3>Full Candidate</h3>
        <pre>{JSON.stringify(candidate, null, 2)}</pre>
      </div>
    </aside>
  );
}

type DetailFieldProps = {
  label: string;
  value: unknown;
  wide?: boolean;
};

function DetailField({ label, value, wide = false }: DetailFieldProps) {
  return (
    <div className={wide ? "detail-field wide" : "detail-field"}>
      <span>{label}</span>
      <strong>{formatDetailValue(value)}</strong>
    </div>
  );
}

function formatDetailValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  return String(value);
}

function formatDuration(value: number | null | undefined) {
  if (!value) {
    return null;
  }

  const totalSeconds = Math.round(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getCandidateTags(candidate: RemixSearchCandidate) {
  return Array.from(
    new Set(
      [candidate.genre, ...parseTags(candidate.subGenre)]
        .map((tag) => tag?.trim())
        .filter((tag): tag is string => Boolean(tag)),
    ),
  );
}

function parseTags(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return Array.from(value.matchAll(/"([^"]+)"|(\S+)/g))
    .map((match) => match[1] ?? match[2] ?? "")
    .filter(Boolean);
}
