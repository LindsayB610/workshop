import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type BadgeTone = "pink" | "yellow" | "muted" | "red";

export function Badge({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return <span className={cn("mb-badge", `mb-badge-${tone}`, className)}>{children}</span>;
}
