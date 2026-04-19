"use client";

import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, className = "", ...rest },
  ref,
) {
  const autoId = useId();
  const generatedId = id ?? autoId;
  return (
    <label htmlFor={generatedId} className="flex flex-col gap-2 text-sm">
      {label ? <span className="text-text-secondary">{label}</span> : null}
      <input
        id={generatedId}
        ref={ref}
        className={[
          "w-full rounded-[12px] bg-bg px-4 py-3 text-base text-text-primary",
          "border transition-colors duration-150",
          error
            ? "border-red-400/60 focus:border-red-400"
            : "border-border hover:border-accent/60 focus:border-accent",
          "placeholder:text-text-muted outline-none",
          className,
        ].join(" ")}
        {...rest}
      />
      {error ? (
        <span className="text-red-400 text-sm">{error}</span>
      ) : hint ? (
        <span className="text-text-muted text-sm">{hint}</span>
      ) : null}
    </label>
  );
});
