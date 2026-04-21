"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { api } from "@/lib/api";
import { useToast } from "./Toast";
import type { Invite } from "@/lib/types";

export function InviteDialog({
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
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  /* eslint-disable react-hooks/set-state-in-effect -- fetching invite when dialog opens */
  useEffect(() => {
    if (!open || !groupId) return;
    let active = true;
    setInvite(null);
    setError(null);
    setLoading(true);
    api
      .createInvite(groupId)
      .then((inv) => {
        if (active) setInvite(inv);
      })
      .catch((err) => {
        if (active)
          setError(err instanceof Error ? err.message : "Failed to create invite");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, groupId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function copy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      toast("Invite link copied", "success");
    } catch {
      toast("Could not copy link", "error");
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={groupName ? `Invite to ${groupName}` : "Invite members"}
    >
      {loading ? (
        <p className="text-text-secondary">Generating invite link…</p>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : invite ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            Anyone with this link who signs in can join this group. The link expires in 7 days.
          </p>
          <div className="flex justify-center rounded-[12px] border border-border bg-white p-4">
            <QRCodeSVG
              value={invite.url}
              size={192}
              level="M"
              marginSize={2}
              aria-label="Invite QR code"
            />
          </div>
          <p className="text-center text-xs text-text-muted">
            Scan with a phone camera to open the link.
          </p>
          <div className="flex items-center gap-2 rounded-[12px] border border-border bg-bg px-3 py-2">
            <code className="flex-1 truncate text-sm text-text-primary">{invite.url}</code>
            <Button size="sm" onClick={copy}>
              Copy
            </Button>
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
