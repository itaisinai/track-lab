type MetricChipProps = {
  children: string | number;
  muted?: boolean;
};

export function MetricChip({ children, muted = false }: MetricChipProps) {
  return (
    <span className={muted ? "metric-chip muted" : "metric-chip"}>
      {children}
    </span>
  );
}
