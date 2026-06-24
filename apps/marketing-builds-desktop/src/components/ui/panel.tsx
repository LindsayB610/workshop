import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export function Panel({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode;
}) {
  return (
    <section className={cn("mb-panel", className)} {...props}>
      {children}
    </section>
  );
}
