"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "./Toast";
import type { FileItem } from "@/lib/types";

export function FileModal({
  file,
  onClose,
  onShare,
}: {
  file: FileItem | null;
  onClose: () => void;
  onShare: (f: FileItem) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  if (!file) return null;

  const isOwner = user?.id === file.userId;

  async function onDelete() {
    if (!file) return;
    if (!confirm(`Delete "${file.fileName}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.deleteFile(file.id, file.userId);
      toast("File deleted", "success");
      qc.invalidateQueries({ queryKey: ["files"] });
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  }

  function onDownload() {
    if (!file?.downloadUrl) {
      toast("Download URL not ready yet — refresh", "error");
      return;
    }
    const a = document.createElement("a");
    a.href = file.downloadUrl;
    a.download = file.fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <Dialog open onClose={onClose} title={file.fileName} fullScreenOnMobile>
      <div className="flex flex-col gap-5">
        <div className="overflow-hidden rounded-[12px] border border-border bg-bg">
          {file.previewUrl || file.thumbnailDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={file.previewUrl || file.thumbnailDataUrl}
              alt={file.fileName}
              className="max-h-[70vh] w-full object-contain"
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center text-text-muted">
              {file.fileKind === "raw"
                ? "Camera RAW — preview not available in the browser"
                : file.status === "processing"
                  ? "Processing…"
                  : "No preview"}
            </div>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Detail label="Uploader" value={file.uploadedBy} />
          <Detail label="Size" value={formatSize(file.fileSize)} />
          <Detail label="Type" value={file.mimeType} />
          <Detail
            label="Status"
            value={file.status === "ready" ? "Ready" : file.status === "processing" ? "Processing…" : "Error"}
          />
        </dl>
        <div className="flex flex-wrap justify-end gap-2">
          {isOwner || file.groupId ? (
            <Button variant="danger" onClick={onDelete} loading={deleting}>
              Delete
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => onShare(file)}>
            Share
          </Button>
          <Button onClick={onDownload} disabled={!file.downloadUrl}>
            Download
          </Button>
        </div>
      </div>
    </Dialog>
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
