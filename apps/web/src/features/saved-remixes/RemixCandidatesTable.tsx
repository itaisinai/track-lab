import type { SavedRemixCandidate } from "../../types";
import { formatDate } from "../../lib/format";
import { ProviderIconLink } from "../enrichment/ProviderIconLink";

type RemixCandidatesTableProps = {
  remixes: SavedRemixCandidate[];
  onOpen?: (remix: SavedRemixCandidate) => void;
};

export function RemixCandidatesTable({
  remixes,
  onOpen,
}: RemixCandidatesTableProps) {
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
          {onOpen && <th>Details</th>}
        </tr>
      </thead>
      <tbody>
        {remixes.map((remix) => (
          <tr key={`${remix.provider}-${remix.link}-${remix.savedAt}`}>
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
            {onOpen && (
              <td>
                <button
                  className="secondary compact"
                  type="button"
                  onClick={() => onOpen(remix)}
                >
                  Details
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
