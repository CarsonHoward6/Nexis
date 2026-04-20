"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { Input } from "./Input";
import { api } from "@/lib/api";
import { useToast } from "./Toast";
import type { Camera } from "@/lib/types";

export function CameraDialog({
  open,
  onClose,
  groupId,
  groupName,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string | null;
  groupName?: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);

  const { data: cameras = [], isLoading } = useQuery({
    queryKey: ["cameras", groupId],
    queryFn: () => (groupId ? api.listCameras(groupId) : Promise.resolve([] as Camera[])),
    enabled: !!groupId && open,
  });

  const del = useMutation({
    mutationFn: (cameraId: string) => api.deleteCamera(cameraId),
    onSuccess: () => {
      toast("Camera removed", "success");
      qc.invalidateQueries({ queryKey: ["cameras", groupId] });
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Failed to remove camera", "error"),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={groupName ? `Cameras — ${groupName}` : "Cameras"}
      fullScreenOnMobile
    >
      {showAdd && groupId ? (
        <AddCameraForm
          groupId={groupId}
          onCancel={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            qc.invalidateQueries({ queryKey: ["cameras", groupId] });
          }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            Register a camera (or phone) that will upload straight to this group via
            SFTP. Photos uploaded by that camera will show up here labeled with the
            camera name.
          </p>

          {isLoading ? (
            <p className="text-sm text-text-muted">Loading cameras…</p>
          ) : cameras.length === 0 ? (
            <p className="rounded-[12px] border border-border bg-bg px-4 py-3 text-sm text-text-muted">
              No cameras yet for this group.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {cameras.map((c) => (
                <li
                  key={c.cameraId}
                  className="flex flex-col gap-2 rounded-[12px] border border-border bg-bg px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {c.label}
                      </p>
                      <p className="truncate text-xs text-text-muted">
                        owner: {c.ownerEmail || "(unknown)"}
                      </p>
                    </div>
                    {c.isOwner ? (
                      <button
                        type="button"
                        onClick={() => del.mutate(c.cameraId)}
                        disabled={del.isPending}
                        className="text-xs text-text-muted hover:text-red-400"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-text-secondary">
                    <KeyVal label="SFTP host" value={c.host} />
                    <KeyVal label="User" value={c.sftpUsername} />
                    <KeyVal label="Protocol" value="SFTP · port 22 · key auth" />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={onClose}>
              Done
            </Button>
            <Button onClick={() => setShowAdd(true)}>Add camera</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function KeyVal({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-text-muted">{label}</span>
      <code className="truncate text-text-primary">{value}</code>
    </div>
  );
}

function AddCameraForm({
  groupId,
  onCancel,
  onAdded,
}: {
  groupId: string;
  onCancel: () => void;
  onAdded: () => void;
}) {
  const [label, setLabel] = useState("");
  const [sshPublicKey, setSshPublicKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Camera | null>(null);
  const { toast } = useToast();

  const mut = useMutation({
    mutationFn: () => api.registerCamera(groupId, { label: label.trim(), sshPublicKey: sshPublicKey.trim() }),
    onSuccess: (cam) => {
      setResult(cam);
      toast("Camera registered", "success");
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed to register camera"),
  });

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">
          Configure your camera&apos;s FTP settings with these values. Photos taken
          after you enable <span className="text-text-primary">Auto transfer</span>{" "}
          will appear in <span className="text-text-primary">{result.label}</span>.
        </p>
        <pre className="overflow-x-auto rounded-[12px] border border-border bg-bg p-4 text-xs text-text-primary">
{`Protocol : SFTP (port 22)
Host     : ${result.host}
User     : ${result.sftpUsername}
Auth     : SSH private key (the one paired with the key you pasted)
Remote   : / (uploads land at ${result.s3Path})`}
        </pre>
        <div className="flex justify-end gap-2">
          <Button onClick={onAdded}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        mut.mutate();
      }}
      className="flex flex-col gap-4"
    >
      <Input
        label="Camera name"
        placeholder="e.g. Carson's R6"
        required
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-text-primary">SSH public key</span>
        <span className="text-xs text-text-muted">
          Generate one with{" "}
          <code className="text-text-secondary">ssh-keygen -t ed25519 -f nexis-camera</code>{" "}
          and paste the contents of <code className="text-text-secondary">nexis-camera.pub</code> here.
          Load the matching private key into the camera&apos;s FTP settings.
        </span>
        <textarea
          className="min-h-[96px] resize-y rounded-[12px] border border-border bg-bg px-3 py-2 font-mono text-xs text-text-primary outline-none focus:border-accent"
          placeholder="ssh-ed25519 AAAAC3Nza... carson@laptop"
          required
          value={sshPublicKey}
          onChange={(e) => setSshPublicKey(e.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={mut.isPending}>
          Register
        </Button>
      </div>
    </form>
  );
}
