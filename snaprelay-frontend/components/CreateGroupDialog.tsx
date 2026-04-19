"use client";

import { useState } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { Input } from "./Input";
import { api } from "@/lib/api";
import { useToast } from "./Toast";
import { useQueryClient } from "@tanstack/react-query";

export function CreateGroupDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (groupId: string) => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const g = await api.createGroup(name.trim());
      toast(`Created “${g.name}”`, "success");
      qc.invalidateQueries({ queryKey: ["groups"] });
      setName("");
      onCreated?.(g.id);
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create group", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New group">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Input
          label="Group name"
          autoFocus
          placeholder="Smith Wedding, Varsity Track, …"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} disabled={!name.trim()}>
            Create
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
