import type { TrackAnalysisJob } from "../../types";

type ActiveJobStripProps = {
  activeJobs: TrackAnalysisJob[];
  error: string;
};

export function ActiveJobStrip({ activeJobs, error }: ActiveJobStripProps) {
  if (activeJobs.length === 0 && !error) {
    return null;
  }

  return (
    <section className="job-strip" aria-live="polite">
      {error && <span className="error-text">{error}</span>}
      {activeJobs.map((job) => (
        <span className={`pill ${job.status}`} key={job.id}>
          #{job.id} {job.operation} {job.status}: {formatJobTrackLabel(job)}
        </span>
      ))}
    </section>
  );
}

function formatJobTrackLabel(job: TrackAnalysisJob) {
  if (job.payload.operation === "remix_search") {
    const title = job.payload.request.title;
    const artists = job.payload.request.artists;
    const spotifyUrl = job.payload.request.spotifyUrl ? "Spotify link" : null;
    return [title, artists].filter(Boolean).join(" - ") || spotifyUrl || "Remix search";
  }

  const title = job.payload.track.title;
  const artists = job.payload.track.artists
    .split(",")
    .map((artist) => artist.trim())
    .filter(Boolean);
  const artistLabel = artists.length > 1 ? `${artists[0]}...` : artists[0];

  return [title, artistLabel].filter(Boolean).join(" - ");
}
