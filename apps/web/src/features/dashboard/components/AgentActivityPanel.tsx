import { motion } from "framer-motion";
import type { TrackAnalysisJob } from "../../../types";
import { CardHeading } from "../../../shared/components/CardHeading";
import { GlassCard } from "../../../shared/components/GlassCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";

type AgentActivityPanelProps = {
  activeJobs: TrackAnalysisJob[];
  isLoading: boolean;
};

const activityFlow = [
  "Searching providers",
  "Querying Spotify",
  "Querying Beatport",
  "Running AI enrichment",
  "Retrying weak signals",
  "Finalizing results",
];

export function AgentActivityPanel({
  activeJobs,
  isLoading,
}: AgentActivityPanelProps) {
  const liveJob = activeJobs[0];
  const live = isLoading || Boolean(liveJob);

  return (
    <GlassCard className="xl:col-span-5" delay={0.08}>
      <CardHeading
        eyebrow="Live Agent"
        title="Agent Activity"
        action={<StatusBadge tone={live ? "live" : "default"}>{live ? "Live" : "Idle"}</StatusBadge>}
      />
      <div className="activity-trace" aria-live="polite">
        {activityFlow.map((label, index) => {
          const active = live && index < (isLoading ? 5 : 3);
          const complete = live && index < 2;

          return (
            <div className="activity-step" key={label}>
              <span
                className={
                  active
                    ? "activity-node active"
                    : complete
                      ? "activity-node complete"
                      : "activity-node"
                }
              />
              <span>{label}</span>
              <time>00:00:{String(index + 1).padStart(2, "0")}</time>
            </div>
          );
        })}
      </div>
      <div className="agent-meter" aria-hidden="true">
        {Array.from({ length: 48 }).map((_, index) => (
          <motion.span
            key={index}
            animate={{ scaleY: live ? [0.35, 1, 0.45] : 0.28 }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              delay: index * 0.018,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </GlassCard>
  );
}
