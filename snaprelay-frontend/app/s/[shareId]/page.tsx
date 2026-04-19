"use client";

import { use, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/api";
import type { PublicShare } from "@/lib/types";

export default function SharePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = use(params);
  const [data, setData] = useState<PublicShare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getPublicShare(shareId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Link not found"))
      .finally(() => setLoading(false));
  }, [shareId]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="mb-8">
        <Logo size={32} />
      </div>
      <div className="w-full max-w-lg rounded-[16px] border border-border bg-surface p-8 shadow-[var(--shadow-soft)]">
        {loading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : error ? (
          <>
            <h2 className="mb-2 text-2xl font-semibold">Link unavailable</h2>
            <p className="text-text-secondary">{error}</p>
          </>
        ) : data ? (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-sm text-text-muted">Shared with you</p>
              <h2 className="mt-1 truncate text-2xl font-semibold">{data.fileName}</h2>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="From" value={data.uploadedBy} />
              <Detail label="Size" value={formatSize(data.fileSize)} />
              <Detail label="Type" value={data.mimeType} />
              <Detail label="Expires" value={new Date(data.expiresAt).toLocaleString()} />
            </dl>
            <Button size="lg" onClick={() => window.open(data.downloadUrl, "_blank")}>
              Download
            </Button>
            <p className="text-xs text-text-muted">
              Downloading from SnapRelay — this link is temporary and works without an account.
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs uppercase tracking-wider text-text-muted">{label}</dt>
      <dd className="truncate text-text-primary">{value}</dd>
    </div>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
