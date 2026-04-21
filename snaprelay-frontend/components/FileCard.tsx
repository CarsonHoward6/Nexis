"use client";

import { memo, useEffect, useState } from "react";
import type { FileItem } from "@/lib/types";

// The backend regenerates presignGet URLs on every listFiles poll, so the raw
// `previewUrl` prop changes every 3s even when the underlying image is the
// same. Swapping <img src> on every poll makes the browser re-fetch and paint,
// which looks like a flicker. We capture the first URL we see for a given
// fileId and hold onto it until the fileId itself changes (unmount + remount).
// When the file transitions processing → ready we do pick up the new URL
// because the initial one was empty.

export const FileCard = memo(
  function FileCard({
    file,
    onOpen,
  }: {
    file: FileItem;
    onOpen: (file: FileItem) => void;
  }) {
    const incoming = file.previewUrl || file.thumbnailDataUrl;
    const [src, setSrc] = useState<string | undefined>(incoming);

    useEffect(() => {
      if (!src && incoming) setSrc(incoming);
    }, [src, incoming]);

    return (
      <button
        type="button"
        onClick={() => onOpen(file)}
        aria-label={file.fileName}
        className="group relative overflow-hidden rounded-[12px] border border-border bg-surface shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[var(--shadow-hover)]"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-bg">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <Placeholder kind={file.fileKind} />
          )}
          <StatusBadge status={file.status} />
        </div>
      </button>
    );
  },
  // Avoid re-rendering on polls that only change presigned URLs or timestamps.
  (prev, next) =>
    prev.file.id === next.file.id &&
    prev.file.status === next.file.status &&
    prev.onOpen === next.onOpen,
);

function Placeholder({ kind }: { kind: FileItem["fileKind"] }) {
  const label = kind === "raw" ? "RAW" : kind === "image" ? "IMG" : "FILE";
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-text-muted">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="M21 15l-5-5L5 21" strokeLinejoin="round" />
        </svg>
        <span className="text-xs font-medium tracking-wider">{label}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: FileItem["status"] }) {
  if (status === "ready") return null;
  const map = {
    processing: { label: "Processing", cls: "bg-accent/20 text-accent" },
    error: { label: "Error", cls: "bg-red-500/20 text-red-400" },
  } as const;
  const entry = status === "error" ? map.error : map.processing;
  return (
    <span
      className={[
        "absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium backdrop-blur",
        entry.cls,
      ].join(" ")}
    >
      {status === "processing" ? (
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
      ) : null}
      {entry.label}
    </span>
  );
}
