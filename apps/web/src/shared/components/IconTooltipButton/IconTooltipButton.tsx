import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconTooltipButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
  compact?: boolean;
};

export function IconTooltipButton({
  icon,
  label,
  className = "",
  compact = true,
  ...props
}: IconTooltipButtonProps) {
  const ariaLabel = props["aria-label"] ?? label;
  const classes = [
    "icon-action-button",
    compact ? "compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} type="button" aria-label={ariaLabel} {...props}>
      <span className="icon-action-button-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="icon-action-button-label">{label}</span>
    </button>
  );
}
