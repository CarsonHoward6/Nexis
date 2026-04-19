"use client";

import { useRef, useState } from "react";
import { Button } from "./Button";
import { api } from "@/lib/api";
import { fileToDataUrl, putWithProgress } from "@/lib/upload";
import { useToast } from "./Toast";
import { useQueryClient } from "@tanstack/react-query";

export function UploadZone({ groupId }: { groupId: string | null }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<
    { name: string; pct: number } | null
  >(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploading({ name: file.name, pct: 0 });
    try {
      const presign = await api.presignUpload({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        groupId,
        isPublic: false,
      });
      await putWithProgress(presign.uploadUrl, file, (p) =>
        setUploading({ name: file.name, pct: p.pct }),
      );
      const thumb = await fileToDataUrl(file);
      await api.savePhoto({
        fileId: presign.fileId,
        s3Key: presign.s3Key,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        groupId,
        isPublic: false,
        thumbnailDataUrl: thumb,
      });
      toast("Uploaded — processing in the background", "success");
      qc.invalidateQueries({ queryKey: ["files"] });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={[
        "flex flex-col items-center justify-center gap-3 rounded-[16px] border border-dashed bg-bg px-6 py-8 text-center transition-colors",
        dragging ? "border-accent bg-accent/5" : "border-border hover:border-accent/60",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        accept="image/*,.cr2,.cr3,.nef,.arw,.dng,.raf,.rw2,.orf"
      />
      {uploading ? (
        <div className="flex w-full max-w-sm flex-col items-center gap-2">
          <p className="truncate text-sm text-text-secondary">{uploading.name}</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-150"
              style={{ width: `${Math.round(uploading.pct * 100)}%` }}
            />
          </div>
          <p className="text-xs text-text-muted">{Math.round(uploading.pct * 100)}%</p>
        </div>
      ) : (
        <>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" />
            <path d="M12 3v12M7 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <p className="text-base text-text-primary">
              Drop a file here, or{" "}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-accent hover:brightness-110 underline-offset-4 hover:underline"
              >
                browse
              </button>
            </p>
            <p className="text-sm text-text-muted">
              JPG, PNG, WebP, or camera RAW (CR3, NEF, ARW, DNG…)
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
            Choose file
          </Button>
        </>
      )}
    </div>
  );
}
