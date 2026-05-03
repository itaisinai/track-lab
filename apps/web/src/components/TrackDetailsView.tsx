import type { TrackDetails } from "../types";
import "./TrackDetailsView.css";

export function TrackDetailsView({ details }: { details: TrackDetails }) {
  return (
    <div className="details">
      <section className="matched-track">
        <span>Matched Track</span>
        <strong>{details.title ?? "Unknown title"}</strong>
        <p>{details.artists ?? "Unknown artists"}</p>
      </section>
      <div className="detail">
        <span>Album</span>
        <strong>{details.album ?? "Unknown"}</strong>
      </div>
      <div className="detail">
        <span>BPM</span>
        <strong>{details.bpm ?? "Unknown"}</strong>
      </div>
      <div className="detail">
        <span>Genre</span>
        <strong>{details.genre ?? "Unknown"}</strong>
      </div>
      <div className="detail">
        <span>Subgenre</span>
        <strong>{details.subGenre ?? "Unknown"}</strong>
      </div>
      <div className="detail">
        <span>Key</span>
        <strong>{details.key ?? "Unknown"}</strong>
      </div>
      <div className="summary">
        <span>Summary</span>
        <p>{details.summary ?? "No summary returned."}</p>
        {details.spotifyUrl && (
          <a
            className="spotify-link"
            href={details.spotifyUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open in Spotify
          </a>
        )}
      </div>
      {details.toolsUsed && details.toolsUsed.length > 0 && (
        <div className="summary">
          <span>Tools Used</span>
          <ul className="tool-list">
            {details.toolsUsed.map((tool) => (
              <li key={tool.name}>
                <strong>{tool.name}</strong>:{" "}
                {tool.matched ? "matched" : "not matched"}
                {tool.error ? `, ${tool.error}` : ""}
              </li>
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
