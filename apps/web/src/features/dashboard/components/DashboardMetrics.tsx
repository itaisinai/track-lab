import { motion } from "framer-motion";
import type { SavedTrackResult, TrackAnalysisJob } from "../../../types";

type DashboardMetricsProps = {
  activeJobs: TrackAnalysisJob[];
  allJobs: TrackAnalysisJob[];
  results: SavedTrackResult[];
};

export function DashboardMetrics({
  activeJobs,
  allJobs,
  results,
}: DashboardMetricsProps) {
  const completed = allJobs.filter((job) => job.status === "completed").length;
  const terminalErrors = allJobs.filter(
    (job) => job.status === "failed" || job.status === "dead_lettered",
  ).length;

  return (
    <div className="metric-strip" aria-label="Dashboard metrics">
      <Metric label="Active agents" value={activeJobs.length} />
      <Metric label="Saved tracks" value={results.length} />
      <Metric label="Completed jobs" value={completed} />
      <Metric
        label="Needs review"
        value={terminalErrors}
        tone={terminalErrors > 0 ? "warn" : "ok"}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "ok" | "warn";
}) {
  return (
    <motion.div className={`metric-tile ${tone}`} whileHover={{ y: -2 }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </motion.div>
  );
}
