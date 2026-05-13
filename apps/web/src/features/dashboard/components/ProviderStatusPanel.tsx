import type { TrackDetails } from "../../../types";
import { CardHeading } from "../../../shared/components/CardHeading";
import { GlassCard } from "../../../shared/components/GlassCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { ProviderIconLink } from "../../enrichment/ProviderIconLink";

type ProviderStatusPanelProps = {
  trackDetails: TrackDetails | null;
};

const providerDefaults = [
  {
    name: "Spotify",
    label: ["Spotify"],
    capabilities: ["Metadata", "Artists", "Links"],
  },
  {
    name: "Beatport",
    label: ["Beatport"],
    capabilities: ["Genre", "Release", "Label"],
  },
  {
    name: "GetSongBPM",
    label: ["GetSong", "BPM"],
    capabilities: ["BPM", "Key"],
  },
  {
    name: "SoundCloud",
    label: ["Sound", "Cloud"],
    capabilities: ["Remixes", "Signals"],
  },
  {
    name: "AI Enrichment",
    label: ["AI", "Enrichment"],
    capabilities: ["Synthesis", "Review"],
  },
];

export function ProviderStatusPanel({ trackDetails }: ProviderStatusPanelProps) {
  const providerStatuses = providerDefaults.map((provider) => {
    const status = trackDetails?.providersUsed?.find(
      (item) => item.name.toLowerCase() === provider.name.toLowerCase(),
    );

    return {
      ...provider,
      matched: status?.matched ?? null,
      error: status?.error ?? null,
      url: status?.url ?? null,
    };
  });

  return (
    <GlassCard className="xl:col-span-7" delay={0.14}>
      <CardHeading
        eyebrow="Provider Mesh"
        title="Provider Status"
        action={
          <span className="provider-count">
            {providerStatuses.filter((provider) => provider.matched !== false).length} online
          </span>
        }
      />
      <div className="provider-grid">
        {providerStatuses.map((provider) => (
          <div
            className="provider-card"
            key={provider.name}
            aria-label={`${provider.name} provider status`}
          >
            <span className="provider-icon-frame">
              {provider.name === "AI Enrichment" ? (
                <AiProviderIcon />
              ) : (
                <ProviderIconLink
                  provider={{
                    name: provider.name,
                    matched: provider.matched,
                    url: provider.url,
                    error: provider.error,
                  }}
                />
              )}
            </span>
            <strong className="provider-title">
              {provider.label.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </strong>
            <StatusBadge tone={provider.error ? "error" : "success"}>
              {provider.error
                ? "Needs attention"
                : provider.matched === false
                  ? "No match"
                  : "Connected"}
            </StatusBadge>
            <div className="capability-row">
              {provider.capabilities.map((capability) => (
                <span key={capability}>{capability}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function AiProviderIcon() {
  return (
    <span className="ai-provider-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z" />
        <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
      </svg>
    </span>
  );
}
