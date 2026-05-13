import type { TrackDetails } from "../../types";
import { ProviderIconLink } from "./ProviderIconLink";
import "./TrackDetailsView.css";

export function TrackDetailsView({ details }: { details: TrackDetails }) {
  return (
    <div className="details">
      <section className="matched-track">
        <span>Matched Track</span>
        <strong>{details.title ?? "N/A"}</strong>
        <p>{details.artists ?? "N/A"}</p>
      </section>
      <div className="detail">
        <span>
          Album <ChangedBadge field="album" details={details} />
        </span>
        <strong>{details.album ?? "N/A"}</strong>
      </div>
      <div className="detail">
        <span>
          BPM <ChangedBadge field="bpm" details={details} />
        </span>
        <strong>{details.bpm ?? "N/A"}</strong>
      </div>
      <div className="detail">
        <span>
          Genre <ChangedBadge field="genre" details={details} />
        </span>
        <strong>{details.genre ?? "N/A"}</strong>
      </div>
      <div className="detail">
        <span>
          Subgenre <ChangedBadge field="subGenre" details={details} />
        </span>
        <strong>{details.subGenre ?? "N/A"}</strong>
      </div>
      <div className="detail">
        <span>
          Key <ChangedBadge field="key" details={details} />
        </span>
        <strong>{details.key ?? "N/A"}</strong>
      </div>
      <div className="summary">
        <span>Summary</span>
        <p>{details.summary ?? "No summary returned."}</p>
        <ChangedBadge field="spotifyUrl" details={details} />
      </div>
      {details.providersUsed && details.providersUsed.length > 0 && (
        <div className="summary">
          <span>Providers</span>
          <ul className="provider-list">
            {details.providersUsed.map((provider) => (
              <li key={provider.name}>
                <ProviderIconLink provider={provider} details={details} />
                <strong>{provider.name}</strong>:{" "}
                {provider.matched ? "matched" : "not matched"}
                {provider.error ? `, ${provider.error}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      {details.reviewNotes && details.reviewNotes.length > 0 && (
        <div className="summary">
          <span>Review Notes</span>
          <ul className="provider-list">
            {details.reviewNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
      {details.conflicts && details.conflicts.length > 0 && (
        <div className="summary">
          <span>Conflicts</span>
          <ul className="provider-list">
            {details.conflicts.map((conflict) => (
              <li key={conflict}>{conflict}</li>
            ))}
          </ul>
        </div>
      )}
      {details.errors && details.errors.length > 0 && (
        <div className="summary">
          <span>Errors</span>
          <ul className="provider-list">
            {details.errors.map((error) => (
              <li key={`${error.source}-${error.message}`}>
                <strong>{error.source}</strong>: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ChangedBadge({
  field,
  details,
}: {
  field: NonNullable<TrackDetails["changedFields"]>[number];
  details: TrackDetails;
}) {
  if (!details.changedFields?.includes(field)) {
    return null;
  }

  return <mark className="changed-badge">Updated</mark>;
}
