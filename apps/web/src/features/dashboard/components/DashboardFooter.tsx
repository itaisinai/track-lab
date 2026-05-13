import type { TrackAnalysisJob } from "../../../types";
import { formatDate } from "../../../lib/format";

type DashboardFooterProps = {
  allJobs: TrackAnalysisJob[];
};

export function DashboardFooter({ allJobs }: DashboardFooterProps) {
  const latest = allJobs[0]?.updatedAt;

  return (
    <p className="dashboard-footer">
      {latest ? `Last job update ${formatDate(latest)}` : "Ready for analysis"}
    </p>
  );
}
