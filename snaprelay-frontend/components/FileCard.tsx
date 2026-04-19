"use client";

import type { FileItem } from "@/lib/types";

export function FileCard({
  file,
  onOpen,
}: {
  file: FileItem;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-[16px] border border-border bg-surface text-left shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[var(--shadow-hover)]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-bg">
        {file.thumbnailDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.thumbnailDataUrl}
            alt={file.fileName}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <Placeholder kind={file.fileKind} />
        )}
        <StatusBadge status={file.status} />
      </div>
      <div className="flex flex-col gap-1 p-4">
        <p className="truncate text-sm font-medium text-text-primary">{file.fileName}</p>
        <p className="text-xs text-text-muted">
          {file.uploadedBy} · {formatSize(file.fileSize)} · {timeAgo(file.uploadedAt)}
        </p>
      </div>
    </button>
  );
}

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

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
