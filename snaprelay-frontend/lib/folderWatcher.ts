"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { fileToDataUrl, putWithProgress } from "./upload";

type Status = {
  watching: boolean;
  folderName: string | null;
  uploaded: number;
  failed: number;
  inFlight: string | null;
  lastError: string | null;
};

type Watcher = {
  handle: FileSystemDirectoryHandle;
  seen: Set<string>;
  queue: Promise<void>;
  cancelled: boolean;
  timer: ReturnType<typeof setInterval> | null;
};

const POLL_MS = 2000;
const ACCEPT_EXT = /\.(jpe?g|png|webp|heic|cr2|cr3|nef|arw|dng|raf|rw2|orf)$/i;

// Module-level so the watcher survives dialog close/reopen.
const state: Record<string, Watcher> = {};
const listeners: Record<string, Set<(s: Status) => void>> = {};
const status: Record<string, Status> = {};

function emit(key: string) {
  const s = status[key];
  (listeners[key] ?? new Set()).forEach((fn) => fn(s));
}

function setStatus(key: string, patch: Partial<Status>) {
  status[key] = {
    ...(status[key] ?? {
      watching: false,
      folderName: null,
      uploaded: 0,
      failed: 0,
      inFlight: null,
      lastError: null,
    }),
    ...patch,
  };
  emit(key);
}

export function browserSupportsFolderWatch() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export function useFolderWatcher(groupId: string | null) {
  const key = groupId ?? "__mine__";
  const [snapshot, setSnapshot] = useState<Status>(
    status[key] ?? {
      watching: false,
      folderName: null,
      uploaded: 0,
      failed: 0,
      inFlight: null,
      lastError: null,
    },
  );

  useEffect(() => {
    const set = (listeners[key] ??= new Set());
    set.add(setSnapshot);
    return () => {
      set.delete(setSnapshot);
    };
  }, [key]);

  return {
    status: snapshot,
    start: () => start(groupId),
    stop: () => stop(groupId),
  };
}

async function start(groupId: string | null) {
  const key = groupId ?? "__mine__";
  if (state[key]) return;
  if (!browserSupportsFolderWatch()) {
    setStatus(key, {
      lastError: "This browser does not support folder watching. Use Chrome or Edge.",
    });
    return;
  }

  let handle: FileSystemDirectoryHandle;
  try {
    handle = await (window as any).showDirectoryPicker({ mode: "read" });
  } catch {
    return; // user cancelled
  }

  const seen = new Set<string>();
  // Mark all pre-existing files as already-seen so we only upload new ones.
  for await (const [name, h] of (handle as any).entries()) {
    if (h.kind === "file") seen.add(name);
  }

  const w: Watcher = {
    handle,
    seen,
    queue: Promise.resolve(),
    cancelled: false,
    timer: null,
  };
  state[key] = w;
  setStatus(key, {
    watching: true,
    folderName: handle.name,
    uploaded: 0,
    failed: 0,
    inFlight: null,
    lastError: null,
  });

  const tick = async () => {
    if (w.cancelled) return;
    try {
      for await (const [name, h] of (w.handle as any).entries()) {
        if (h.kind !== "file") continue;
        if (w.seen.has(name)) continue;
        if (!ACCEPT_EXT.test(name)) {
          w.seen.add(name);
          continue;
        }
        w.seen.add(name);
        w.queue = w.queue.then(() => uploadOne(key, groupId, h as FileSystemFileHandle));
      }
    } catch (e) {
      console.warn("folder scan failed", e);
    }
  };
  w.timer = setInterval(tick, POLL_MS);
  tick();
}

function stop(groupId: string | null) {
  const key = groupId ?? "__mine__";
  const w = state[key];
  if (!w) return;
  w.cancelled = true;
  if (w.timer) clearInterval(w.timer);
  delete state[key];
  setStatus(key, { watching: false, folderName: null, inFlight: null });
}

async function uploadOne(key: string, groupId: string | null, h: FileSystemFileHandle) {
  let file: File;
  try {
    file = await h.getFile();
  } catch (e) {
    setStatus(key, {
      failed: (status[key]?.failed ?? 0) + 1,
      lastError: e instanceof Error ? e.message : "Could not read file",
    });
    return;
  }
  setStatus(key, { inFlight: file.name, lastError: null });
  try {
    const presign = await api.presignUpload({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      groupId,
      isPublic: false,
    });
    await putWithProgress(presign.uploadUrl, file);
    const thumb = await fileToDataUrl(file).catch(() => undefined);
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
    setStatus(key, {
      uploaded: (status[key]?.uploaded ?? 0) + 1,
      inFlight: null,
    });
  } catch (e) {
    setStatus(key, {
      failed: (status[key]?.failed ?? 0) + 1,
      inFlight: null,
      lastError: e instanceof Error ? e.message : "Upload failed",
    });
  }
}
