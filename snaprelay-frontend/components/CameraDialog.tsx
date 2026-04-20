"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { Input } from "./Input";
import { api } from "@/lib/api";
import { useToast } from "./Toast";
import { browserSupportsFolderWatch, useFolderWatcher } from "@/lib/folderWatcher";
import type { Camera } from "@/lib/types";

type Mode = "home" | "add-easy" | "add-advanced";

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
  const [mode, setMode] = useState<Mode>("home");

  useEffect(() => {
    if (open) setMode("home");
  }, [open, groupId]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={groupName ? `Cameras — ${groupName}` : "Cameras"}
      fullScreenOnMobile
    >
      {mode === "add-easy" && groupId ? (
        <EasyPath
          groupId={groupId}
          groupName={groupName || "this group"}
          onBack={() => setMode("home")}
        />
      ) : mode === "add-advanced" && groupId ? (
        <AdvancedPath groupId={groupId} onBack={() => setMode("home")} />
      ) : (
        <Home
          groupId={groupId}
          onClose={onClose}
          onPickEasy={() => setMode("add-easy")}
          onPickAdvanced={() => setMode("add-advanced")}
        />
      )}
    </Dialog>
  );
}

// ------------------------------- Home -------------------------------

function Home({
  groupId,
  onClose,
  onPickEasy,
  onPickAdvanced,
}: {
  groupId: string | null;
  onClose: () => void;
  onPickEasy: () => void;
  onPickAdvanced: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: cameras = [], isLoading } = useQuery({
    queryKey: ["cameras", groupId],
    queryFn: () => (groupId ? api.listCameras(groupId) : Promise.resolve([] as Camera[])),
    enabled: !!groupId,
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
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <OptionCard
          title="Watch a folder (easiest)"
          subtitle="Free · uses your laptop"
          body="Canon EOS Utility (or any app) drops each photo into a folder, and this tab uploads them to the group automatically."
          cta="Set up folder watch"
          onClick={onPickEasy}
          accent
        />
        <OptionCard
          title="Direct camera FTP"
          subtitle="Advanced · costs while online"
          body="Connect the camera's built-in Wi-Fi FTP straight to AWS. Needs an SSH key and the Transfer Family server running ($0.30/hr)."
          cta="Add with SFTP"
          onClick={onPickAdvanced}
        />
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Registered cameras (direct FTP)
        </h4>
        {isLoading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : cameras.length === 0 ? (
          <p className="rounded-[12px] border border-border bg-bg px-4 py-3 text-sm text-text-muted">
            No direct-FTP cameras yet. The watch-folder option above doesn&apos;t need a registered camera.
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
                    <p className="truncate text-sm font-medium text-text-primary">{c.label}</p>
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
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

function OptionCard({
  title,
  subtitle,
  body,
  cta,
  onClick,
  accent,
}: {
  title: string;
  subtitle: string;
  body: string;
  cta: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex flex-col gap-2 rounded-[12px] border bg-bg px-4 py-4 text-left transition-colors",
        accent
          ? "border-accent/50 hover:border-accent"
          : "border-border hover:border-accent/60",
      ].join(" ")}
    >
      <div>
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <p className="text-xs text-text-muted">{subtitle}</p>
      </div>
      <p className="text-sm text-text-secondary">{body}</p>
      <p className={["mt-2 text-sm", accent ? "text-accent" : "text-text-primary"].join(" ")}>
        {cta} →
      </p>
    </button>
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

// ----------------------- Easy: watch a folder -----------------------

function EasyPath({
  groupId,
  groupName,
  onBack,
}: {
  groupId: string;
  groupName: string;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const supported = browserSupportsFolderWatch();
  const { status, start, stop } = useFolderWatcher(groupId);

  // When a new file finishes uploading, refresh the gallery.
  useEffect(() => {
    if (status.uploaded > 0) qc.invalidateQueries({ queryKey: ["files"] });
  }, [status.uploaded, qc]);

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-xs text-text-muted hover:text-text-primary"
      >
        ← Back
      </button>

      <div>
        <h4 className="text-base font-semibold text-text-primary">Watch a folder</h4>
        <p className="text-sm text-text-secondary">
          Any photo that lands in the folder you pick gets uploaded to{" "}
          <span className="text-text-primary">{groupName}</span> within a second or two.
        </p>
      </div>

      <ol className="flex flex-col gap-4">
        <Step n={1} title="Plug the camera into your laptop">
          Use the USB-C cable (or connect the camera to Wi-Fi on the same network).
          The R6 will show up as an EOS device.
        </Step>
        <Step n={2} title="Open Canon EOS Utility and enable Monitor Folder">
          <span>
            <span className="block">EOS Utility → <em>Download images from camera</em> → <em>Preferences</em> → <em>Destination Folder</em>. Pick a new empty folder (e.g. <code>~/Pictures/Nexis</code>).</span>
            <span className="mt-1 block">Then back in EOS Utility: <em>Monitor Folder</em> → ON. Every new shot now lands there within a second.</span>
          </span>
        </Step>
        <Step n={3} title="Tell this tab to watch that same folder">
          {supported ? (
            status.watching ? (
              <div className="flex flex-col gap-2 rounded-[12px] border border-accent/40 bg-accent/5 px-3 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-primary">
                    Watching <code>{status.folderName}</code>
                  </span>
                  <Button size="sm" variant="ghost" onClick={stop}>
                    Stop
                  </Button>
                </div>
                <div className="text-xs text-text-muted">
                  {status.inFlight
                    ? `Uploading ${status.inFlight}…`
                    : `Idle. Uploaded ${status.uploaded}${
                        status.failed ? ` · ${status.failed} failed` : ""
                      }.`}
                </div>
                {status.lastError ? (
                  <div className="text-xs text-red-400">Last error: {status.lastError}</div>
                ) : null}
              </div>
            ) : (
              <Button size="sm" onClick={start}>
                Choose folder to watch
              </Button>
            )
          ) : (
            <p className="rounded-[12px] border border-border bg-bg px-3 py-2 text-xs text-text-muted">
              Your browser doesn&apos;t support folder watching. Use Chrome or Edge, or drag
              files into the main upload box instead.
            </p>
          )}
        </Step>
        <Step n={4} title="Shoot">
          Take a picture. It hits the folder, this tab uploads it, and everyone in{" "}
          <span className="text-text-primary">{groupName}</span> sees it in ~3–5 seconds.
          Leave this tab open while shooting.
        </Step>
      </ol>

      <div className="rounded-[12px] border border-border bg-bg px-4 py-3 text-xs text-text-muted">
        <strong className="text-text-secondary">Why this is free:</strong> Nothing runs on AWS
        except the normal upload API. No SFTP server to keep online; your laptop is the
        bridge. Close the tab and the watcher stops.
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
        {n}
      </span>
      <div className="flex flex-col gap-1 text-sm">
        <p className="font-medium text-text-primary">{title}</p>
        <div className="text-text-secondary">{children}</div>
      </div>
    </li>
  );
}

// --------------------- Advanced: direct camera SFTP ---------------------

function AdvancedPath({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [label, setLabel] = useState("");
  const [sshPublicKey, setSshPublicKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Camera | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      api.registerCamera(groupId, { label: label.trim(), sshPublicKey: sshPublicKey.trim() }),
    onSuccess: (cam) => {
      setResult(cam);
      toast("Camera registered", "success");
      qc.invalidateQueries({ queryKey: ["cameras", groupId] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed to register camera"),
  });

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={onBack}
          className="self-start text-xs text-text-muted hover:text-text-primary"
        >
          ← Back to cameras
        </button>
        <h4 className="text-base font-semibold text-text-primary">Configure the camera</h4>
        <p className="text-sm text-text-secondary">
          Paste these into the R6&apos;s FTP settings (Wireless → FTP trans. settings). Make
          sure the Transfer Family server is ONLINE ($0.30/hr) before shooting.
        </p>
        <pre className="overflow-x-auto rounded-[12px] border border-border bg-bg p-4 text-xs text-text-primary">
{`Protocol : SFTP (port 22)
Host     : ${result.host}
User     : ${result.sftpUsername}
Auth     : SSH private key (the one paired with the key you pasted)
Remote   : /   (uploads land at ${result.s3Path})`}
        </pre>
        <div className="flex justify-end">
          <Button onClick={onBack}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-xs text-text-muted hover:text-text-primary"
      >
        ← Back
      </button>

      <div>
        <h4 className="text-base font-semibold text-text-primary">Direct camera FTP</h4>
        <p className="text-sm text-text-secondary">
          Skip the laptop bridge and have the camera FTP directly to AWS. Your R6 needs
          firmware 1.6.0+ for SFTP.
        </p>
      </div>

      <ol className="flex flex-col gap-4">
        <Step n={1} title="Generate an SSH keypair">
          <>
            <p>In a terminal on any computer, run:</p>
            <pre className="mt-1 overflow-x-auto rounded-[10px] border border-border bg-bg p-2 text-xs text-text-primary">
ssh-keygen -t ed25519 -f nexis-camera
            </pre>
            <p className="mt-1 text-xs text-text-muted">
              This makes two files: <code>nexis-camera</code> (private — goes on the camera)
              and <code>nexis-camera.pub</code> (public — paste below).
            </p>
          </>
        </Step>
        <Step n={2} title="Name the camera and paste the public key">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              mut.mutate();
            }}
            className="mt-1 flex flex-col gap-3"
          >
            <Input
              label="Camera name"
              placeholder="e.g. Carson's R6"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-text-secondary">
                Contents of <code>nexis-camera.pub</code>
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
            <div>
              <Button type="submit" loading={mut.isPending} size="sm">
                Register camera
              </Button>
            </div>
          </form>
        </Step>
        <Step n={3} title="Start the SFTP server before shooting">
          <p>
            The server is OFFLINE by default. Run{" "}
            <code>bash snaprelay-backend/infra/sftp-on.sh</code> before the shoot and{" "}
            <code>sftp-off.sh</code> after — otherwise AWS charges $0.30/hr continuously.
          </p>
        </Step>
        <Step n={4} title="Configure the R6">
          <p>
            Wireless → Wi-Fi settings → Communication mode → <em>FTP trans.</em>. Mode{" "}
            <em>SFTP</em>, host/user from the previous step, auth = private key (load{" "}
            <code>nexis-camera</code> via SD card). Turn <em>Auto transfer after shot</em>{" "}
            ON.
          </p>
        </Step>
      </ol>
    </div>
  );
}
