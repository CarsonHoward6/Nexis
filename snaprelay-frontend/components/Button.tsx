"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-text-inverse hover:brightness-110 active:brightness-95 disabled:bg-disabled disabled:text-text-muted",
  secondary:
    "bg-surface-elevated text-text-primary hover:bg-[color-mix(in_oklab,var(--surface-elevated)_85%,white)] active:brightness-95 disabled:text-text-muted",
  ghost:
    "bg-transparent text-text-primary hover:bg-surface active:brightness-95 disabled:text-text-muted",
  danger:
    "bg-transparent text-red-400 border border-red-400/40 hover:bg-red-500/10 active:brightness-95",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5",
  md: "text-base px-5 py-3",
  lg: "text-lg px-6 py-3.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className = "", children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-[12px] font-medium",
        "transition-[transform,filter,background-color,box-shadow] duration-150 ease-in-out",
        "active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(" ")}
      {...rest}
    >
      {loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
});
