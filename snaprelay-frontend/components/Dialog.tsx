"use client";

import { useEffect } from "react";

export function Dialog({
  open,
  onClose,
  children,
  title,
  fullScreenOnMobile = false,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  fullScreenOnMobile?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={[
          "relative w-full bg-surface text-text-primary shadow-[var(--shadow-hover)]",
          fullScreenOnMobile
            ? "h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-[16px]"
            : "max-h-[90vh] max-w-md rounded-t-[16px] sm:rounded-[16px]",
          "overflow-y-auto border border-border",
        ].join(" ")}
      >
        {title ? (
          <div className="flex items-center justify-between border-b border-divider px-6 py-4">
            <h3 className="text-lg font-medium">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1 text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ) : null}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
