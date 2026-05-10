import type { SavedTrackResult } from "../../../types";
import { CardHeading } from "../../../shared/components/CardHeading";
import { ConfidenceBar } from "../../../shared/components/ConfidenceBar";
import { GlassCard } from "../../../shared/components/GlassCard";
import { MetricChip } from "../../../shared/components/MetricChip";

type RecentResultsPanelProps = {
  results: SavedTrackResult[];
  onSavedResultsClick: () => void;
};

export function RecentResultsPanel({
  results,
  onSavedResultsClick,
}: RecentResultsPanelProps) {
  const recent = results.slice(0, 5);

  return (
    <GlassCard className="xl:col-span-5" delay={0.18}>
      <CardHeading
        eyebrow="Library Signals"
        title="Recent Results"
        action={
          <button className="ghost-link" type="button" onClick={onSavedResultsClick}>
            View all
          </button>
        }
      />
      <div className="recent-results">
        {recent.length > 0 ? (
          recent.map((result) => (
            <div className="result-card-row" key={result.id}>
              <div className="result-track">
                <strong>{result.title}</strong>
                <span>{result.artists}</span>
              </div>
              <div className="result-meta">
                <MetricChip>{`${result.bpm ?? "N/A"} BPM`}</MetricChip>
                <MetricChip muted>{result.key ?? "N/A"}</MetricChip>
                <MetricChip muted>{result.genre ?? "Unknown"}</MetricChip>
              </div>
              <ConfidenceBar value={getConfidence(result)} />
              <span className={`pill ${result.status}`}>{result.status}</span>
            </div>
          ))
        ) : (
          <div className="skeleton-list" aria-label="No recent results yet">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function getConfidence(result: SavedTrackResult) {
  if (result.status === "complete") {
    return Math.max(86, getProviderScore(result));
  }

  if (result.status === "partial") {
    return Math.max(58, getProviderScore(result));
  }

  return 24;
}

function getProviderScore(result: SavedTrackResult) {
  if (result.toolsUsed.length === 0) {
    return 52;
  }

  const matched = result.toolsUsed.filter((provider) => provider.matched).length;
  return Math.round((matched / result.toolsUsed.length) * 100);
}
