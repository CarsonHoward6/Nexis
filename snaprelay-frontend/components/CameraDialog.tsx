"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { Input } from "./Input";
import { api } from "@/lib/api";
import { useToast } from "./Toast";
import { browserSupportsFolderWatch, useFolderWatcher } from "@/lib/folderWatcher";
import type { Camera, PhoneBridge } from "@/lib/types";

type Mode = "home" | "add-easy" | "add-phone" | "add-advanced";

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
      ) : mode === "add-phone" && groupId ? (
        <PhonePath
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
          onPickPhone={() => setMode("add-phone")}
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
  onPickPhone,
  onPickAdvanced,
}: {
  groupId: string | null;
  onClose: () => void;
  onPickEasy: () => void;
  onPickPhone: () => void;
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
      <div className="grid gap-3 sm:grid-cols-3">
        <OptionCard
          title="Watch a folder"
          subtitle="Free · laptop required"
          body="EOS Utility drops each photo into a folder on your laptop, and this tab auto-uploads them."
          cta="Set up folder watch"
          onClick={onPickEasy}
          accent
        />
        <OptionCard
          title="From my phone"
          subtitle="Free · iOS Shortcut"
          body="Canon Camera Connect sends each photo to your phone, and an iOS Shortcut forwards it to Nexis."
          cta="Set up phone bridge"
          onClick={onPickPhone}
          accent
        />
        <OptionCard
          title="Direct camera FTP"
          subtitle="Advanced · $0.30/hr"
          body="Camera FTPs straight to AWS. Needs an SSH key and the Transfer Family server online."
          cta="Add with SFTP"
          onClick={onPickAdvanced}
        />
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Registered cameras &amp; bridges
        </h4>
        {isLoading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : cameras.length === 0 ? (
          <p className="rounded-[12px] border border-border bg-bg px-4 py-3 text-sm text-text-muted">
            Nothing registered yet. Watch-a-folder above doesn&apos;t need a registration.
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
                      {c.type === "phone" ? "📱 " : "📷 "}
                      {c.label}
                    </p>
                    <p className="truncate text-xs text-text-muted">
                      {c.type === "phone" ? "Phone bridge" : "Direct FTP"} · owner:{" "}
                      {c.ownerEmail || "(unknown)"}
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
                {c.type === "sftp" ? (
                  <div className="flex flex-col gap-1 text-xs text-text-secondary">
                    <KeyVal label="SFTP host" value={c.host} />
                    <KeyVal label="User" value={c.sftpUsername} />
                  </div>
                ) : null}
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

// ---------------------- Phone bridge (iOS Shortcut) ----------------------

function PhonePath({
  groupId,
  groupName,
  onBack,
}: {
  groupId: string;
  groupName: string;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bridge, setBridge] = useState<PhoneBridge | null>(null);

  const mut = useMutation({
    mutationFn: () => api.createPhoneBridge(groupId, label.trim()),
    onSuccess: (b) => {
      setBridge(b);
      toast("Phone bridge created", "success");
      qc.invalidateQueries({ queryKey: ["cameras", groupId] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed to create bridge"),
  });

  async function copy(value: string, note: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${note} copied`, "success");
    } catch {
      toast("Could not copy", "error");
    }
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
        <h4 className="text-base font-semibold text-text-primary">
          Phone bridge — R6 → phone → Nexis
        </h4>
        <p className="text-sm text-text-secondary">
          After setup, every photo your R6 sends to Camera Connect auto-uploads to{" "}
          <span className="text-text-primary">{groupName}</span>.
        </p>
      </div>

      <ol className="flex flex-col gap-4">
        <Step n={1} title="Pair the R6 with Canon Camera Connect on your phone">
          Wireless → Wi-Fi → <em>Connect to smartphone</em>. (One-time setup per phone.)
          You probably already have this done.
        </Step>

        <Step n={2} title="Name this bridge, then register it">
          {bridge ? (
            <p className="text-sm text-text-secondary">
              Registered <span className="text-text-primary">{bridge.label}</span>. Scroll
              down for your token and Shortcut setup.
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                mut.mutate();
              }}
              className="mt-1 flex flex-col gap-3"
            >
              <Input
                label="Bridge name"
                placeholder="e.g. Carson's iPhone → Wedding"
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              <div>
                <Button type="submit" loading={mut.isPending} size="sm">
                  Register bridge
                </Button>
              </div>
            </form>
          )}
        </Step>

        {bridge ? (
          <>
            <Step n={3} title="Copy your URL and token">
              <div className="mt-1 flex flex-col gap-3">
                <div className="rounded-[12px] border border-accent/40 bg-accent/5 px-3 py-2 text-xs text-text-muted">
                  This token is shown once. If you lose it, remove the bridge and make a new one.
                </div>
                <TokenBlock
                  label="Presign URL"
                  value={bridge.presignUrl}
                  onCopy={() => copy(bridge.presignUrl, "URL")}
                />
                <TokenBlock
                  label="Upload token"
                  value={bridge.uploadToken}
                  onCopy={() => copy(bridge.uploadToken, "Token")}
                />
              </div>
            </Step>

            <Step n={4} title="Build the iOS Shortcut">
              <div className="mt-1 flex flex-col gap-2 text-sm">
                <p>On the iPhone, open Shortcuts → new Shortcut → add these steps in order:</p>
                <ol className="ml-4 list-decimal space-y-1 text-text-secondary">
                  <li>
                    <strong>Get Latest Photos</strong> — Count <code>1</code>.
                  </li>
                  <li>
                    <strong>Get Details of Images</strong> — detail{" "}
                    <code>Media Type</code>. Save as <code>mime</code>.
                  </li>
                  <li>
                    <strong>Get Details of Images</strong> — detail{" "}
                    <code>File Extension</code>. Save as <code>ext</code>.
                  </li>
                  <li>
                    <strong>Text</strong>:{" "}
                    <code>photo-{"{"}Current Date, yyyyMMdd-HHmmss{"}"}.{"{"}ext{"}"}</code>.
                    Save as <code>fileName</code>.
                  </li>
                  <li>
                    <strong>Get Contents of URL</strong> (presign):{" "}
                    method <code>POST</code>, URL the presign URL above, Headers{" "}
                    <code>x-nexis-token</code> = your token and{" "}
                    <code>content-type: application/json</code>, Body type <em>JSON</em>:{" "}
                    <code>fileName</code> and <code>mimeType</code>. Save response as{" "}
                    <code>presign</code>.
                  </li>
                  <li>
                    <strong>Get Dictionary Value</strong> — key <code>uploadUrl</code> from{" "}
                    <code>presign</code>.
                  </li>
                  <li>
                    <strong>Get Contents of URL</strong> (upload): method <code>PUT</code>,
                    URL <code>uploadUrl</code>, Headers <code>content-type: {"{"}mime{"}"}</code>,
                    Request Body <em>File</em> (the photo from step 1).
                  </li>
                  <li>
                    <strong>Show Notification</strong> — "Uploaded to Nexis".
                  </li>
                </ol>
              </div>
            </Step>

            <Step n={5} title="Set up the automation">
              <p>
                Shortcuts app → <em>Automation</em> tab → <em>New</em> → <em>Photo</em> → pick{" "}
                <em>Image is taken</em> or <em>Photo added</em> → album{" "}
                <em>Camera Connect</em> (or Camera Roll). Action:{" "}
                <em>Run Shortcut</em> → select the one you just built. Disable{" "}
                <em>Ask before running</em>.
              </p>
            </Step>

            <Step n={6} title="Shoot!">
              On the R6: press <em>Playback</em> → <em>Q</em> →{" "}
              <em>Send images to smartphone</em>. The photo lands in your Camera Roll, the
              automation fires, and the photo appears on{" "}
              <span className="text-text-primary">{groupName}</span> in ~3–5 s.
            </Step>
          </>
        ) : null}
      </ol>
    </div>
  );
}

function TokenBlock({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <span className="text-text-muted">{label}</span>
      <div className="flex items-center gap-2 rounded-[10px] border border-border bg-bg px-3 py-2">
        <code className="flex-1 break-all text-text-primary">{value}</code>
        <Button size="sm" variant="ghost" onClick={onCopy}>
          Copy
        </Button>
      </div>
    </div>
  );
}
