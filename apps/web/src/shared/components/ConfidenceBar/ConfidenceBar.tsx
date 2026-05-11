type ConfidenceBarProps = {
  value: number;
};

export function ConfidenceBar({ value }: ConfidenceBarProps) {
  return (
    <span className="confidence">
      <span>
        <span style={{ width: `${value}%` }} />
      </span>
      <em>{value}%</em>
    </span>
  );
}
