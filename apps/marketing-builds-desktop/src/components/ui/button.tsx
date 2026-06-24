import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

export function Button({
  className,
  variant = "secondary",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button className={cn("mb-button", `mb-button-${variant}`, className)} type={type} {...props}>
      {children}
    </button>
  );
}
