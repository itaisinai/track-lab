import type { TrackAnalysisJob } from "../../types";
import { formatJobTrackLabel } from "../../lib/job-labels";

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
