type StatusBadgeProps = {
  children: string | number;
  tone?: "default" | "success" | "error" | "live";
};

export function StatusBadge({ children, tone = "default" }: StatusBadgeProps) {
  const className =
    tone === "live"
      ? "live-pill active"
      : tone === "success"
        ? "state-badge"
        : tone === "error"
          ? "state-badge error"
          : "live-pill";

  return <span className={className}>{children}</span>;
}
