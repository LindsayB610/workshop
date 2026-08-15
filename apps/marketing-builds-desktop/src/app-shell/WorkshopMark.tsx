import type { CSSProperties } from "react";
import type { ThemeTokens } from "./appearance";

type Props = {
  className?: string;
  label?: string;
  tokens?: Pick<ThemeTokens, "accent" | "accentWarm" | "text">;
};

/** The Workshop product mark: a worktop over a W-shaped set of legs. */
export function WorkshopMark({ className = "", label = "Workshop mark", tokens }: Props) {
  const style = tokens
    ? ({
        "--workshop-mark-table": tokens.text,
        "--workshop-mark-w": tokens.accent,
        "--workshop-mark-inlay": tokens.accentWarm,
      } as CSSProperties)
    : undefined;

  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label || undefined}
      className={`workshop-mark ${className}`.trim()}
      role={label ? "img" : undefined}
      style={style}
      viewBox="40 70 240 200"
    >
      <path className="workshop-mark-table" d="M66 102H254" />
      <path className="workshop-mark-w" d="M80 149L112 239L160 174L208 239L240 149" />
      <path className="workshop-mark-inlay" d="M142 102H178" />
    </svg>
  );
}
