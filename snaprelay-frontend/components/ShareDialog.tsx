"use client";

import { useEffect, useState } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { api } from "@/lib/api";
import { useToast } from "./Toast";
import type { ShareLink } from "@/lib/types";

const OPTIONS: { label: string; seconds: number }[] = [
  { label: "1 hour", seconds: 3600 },
  { label: "24 hours", seconds: 86400 },
  { label: "7 days", seconds: 604800 },
];

export function ShareDialog({
  open,
  onClose,
  fileId,
  fileName,
}: {
  open: boolean;
  onClose: () => void;
  fileId: string | null;
  fileName?: string;
}) {
  const [expires, setExpires] = useState(OPTIONS[1].seconds);
  const [link, setLink] = useState<ShareLink | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setLink(null);
      setExpires(OPTIONS[1].seconds);
    }
  }, [open]);

  async function generate() {
    if (!fileId) return;
    setLoading(true);
    try {
      const l = await api.createShareLink(fileId, expires);
      setLink(l);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not create link", "error");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      toast("Share link copied", "success");
    } catch {
      toast("Could not copy link", "error");
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={fileName ? `Share ${fileName}` : "Share file"}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">
          Share links open a public page where anyone can download this file — no account needed.
        </p>
        <div className="flex flex-col gap-2">
          <span className="text-sm text-text-secondary">Link expires in</span>
          <div className="flex gap-2">
            {OPTIONS.map((o) => (
              <button
                key={o.seconds}
                type="button"
                onClick={() => setExpires(o.seconds)}
                className={[
                  "flex-1 rounded-[12px] border px-3 py-2 text-sm transition-colors",
                  expires === o.seconds
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-text-secondary hover:border-accent/60",
                ].join(" ")}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        {link ? (
          <div className="flex items-center gap-2 rounded-[12px] border border-border bg-bg px-3 py-2">
            <code className="flex-1 truncate text-sm text-text-primary">{link.url}</code>
            <Button size="sm" onClick={copy}>
              Copy
            </Button>
          </div>
        ) : null}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {link ? null : (
            <Button onClick={generate} loading={loading}>
              Generate link
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
