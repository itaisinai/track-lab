import type { ReactNode } from "react";

type CardHeadingProps = {
  eyebrow: string;
  title: string;
  action?: ReactNode;
};

export function CardHeading({ action, eyebrow, title }: CardHeadingProps) {
  return (
    <div className="card-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}
