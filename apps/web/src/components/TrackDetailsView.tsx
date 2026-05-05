import type { TrackDetails } from "../types";
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
      {details.toolsUsed && details.toolsUsed.length > 0 && (
        <div className="summary">
          <span>Tools Used</span>
          <ul className="tool-list">
            {details.toolsUsed.map((tool) => (
              <li key={tool.name}>
                <ProviderIconLink tool={tool} details={details} />
                <strong>{tool.name}</strong>: {tool.matched ? "matched" : "not matched"}
                {tool.error ? `, ${tool.error}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      {details.reviewNotes && details.reviewNotes.length > 0 && (
        <div className="summary">
          <span>Review Notes</span>
          <ul className="tool-list">
            {details.reviewNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
      {details.conflicts && details.conflicts.length > 0 && (
        <div className="summary">
          <span>Conflicts</span>
          <ul className="tool-list">
            {details.conflicts.map((conflict) => (
              <li key={conflict}>{conflict}</li>
            ))}
          </ul>
        </div>
      )}
      {details.errors && details.errors.length > 0 && (
        <div className="summary">
          <span>Errors</span>
          <ul className="tool-list">
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

function ProviderIconLink({
  tool,
  details,
}: {
  tool: NonNullable<TrackDetails["toolsUsed"]>[number];
  details: TrackDetails;
}) {
  const url = getProviderUrl(tool, details);
  const icon = getProviderIcon(tool.name);

  if (!icon) {
    return null;
  }

  if (!url) {
    return <span className={`provider-link disabled ${getProviderClassName(tool.name)}`}>{icon}</span>;
  }

  return (
    <a
      className={`provider-link ${getProviderClassName(tool.name)}`}
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open ${tool.name}`}
      title={`Open ${tool.name}`}
    >
      {icon}
    </a>
  );
}

function getProviderUrl(
  tool: NonNullable<TrackDetails["toolsUsed"]>[number],
  details: TrackDetails,
) {
  if (tool.name === "Spotify") {
    return tool.url ?? details.spotifyUrl ?? null;
  }

  return tool.url ?? null;
}

function getProviderIcon(providerName: string) {
  if (providerName === "Spotify") {
    return <SpotifyIcon />;
  }

  if (providerName === "Beatport") {
    return <BeatportIcon />;
  }

  if (providerName === "Wikipedia") {
    return <WikipediaIcon />;
  }

  if (providerName === "GetSongBPM") {
    return <BpmIcon />;
  }

  return <ProviderFallbackIcon />;
}

function getProviderClassName(providerName: string) {
  return providerName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function SpotifyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="M7.2 9.4c3.4-1 7.1-.7 10.2.9M8 12.3c2.8-.8 5.8-.5 8.2.8M8.8 15c2-.5 4.2-.3 6 .6"
        fill="none"
        stroke="#08130f"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function BeatportIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 17.5V6.5h5.6c2 0 3.2 1 3.2 2.7 0 1-.5 1.8-1.4 2.2 1.3.4 2 1.4 2 2.8 0 2-1.4 3.3-3.7 3.3H7Zm3-6.7h2.1c.7 0 1.1-.4 1.1-1s-.4-1-1.1-1H10v2Zm0 4.3h2.5c.8 0 1.3-.4 1.3-1.1s-.5-1.1-1.3-1.1H10v2.2Z"
        fill="currentColor"
      />
      <path
        d="M4.5 5.5h15v13h-15z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        rx="2"
      />
    </svg>
  );
}

function WikipediaIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3.5 6h17M5 6l4.2 11.5L12 10l2.9 7.5L19 6M8 6h2M14 6h2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function BpmIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 16V8m0 4h3.5a2 2 0 0 0 0-4H5m0 4h4a2 2 0 0 1 0 4H5m8 0V8h2.5l2 5 2-5H22v8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ProviderFallbackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 8v4l2.5 2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
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
