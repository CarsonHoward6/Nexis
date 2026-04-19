"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FileCard } from "./FileCard";
import type { FileItem } from "@/lib/types";

export function FileGrid({
  groupId,
  onOpen,
}: {
  groupId: string | null;
  onOpen: (f: FileItem) => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["files", groupId ?? "mine"],
    queryFn: () => api.listFiles(groupId),
    refetchInterval: (q) => {
      const items = q.state.data as FileItem[] | undefined;
      return items?.some((f) => f.status === "processing") ? 1500 : false;
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[4/3] animate-pulse rounded-[16px] bg-surface"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-[16px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
        {error instanceof Error ? error.message : "Failed to load files"}
      </p>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[16px] border border-dashed border-border py-16 text-center">
        <p className="text-text-primary">No files here yet.</p>
        <p className="text-sm text-text-muted">Drop one above to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.map((f) => (
        <FileCard key={f.id} file={f} onOpen={() => onOpen(f)} />
      ))}
    </div>
  );
}
