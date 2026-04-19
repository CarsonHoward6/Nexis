"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useQueryClient } from "@tanstack/react-query";

export default function JoinPage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = use(params);
  return (
    <AuthGate redirectTo="/login">
      <JoinFlow inviteCode={inviteCode} />
    </AuthGate>
  );
}

function JoinFlow({ inviteCode }: { inviteCode: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- redeeming invite on mount */
  useEffect(() => {
    setAccepting(true);
    setError(null);
    api
      .acceptInvite(inviteCode)
      .then((g) => {
        setAccepted(g.name);
        qc.invalidateQueries({ queryKey: ["groups"] });
        toast(`Joined ${g.name}`, "success");
        setTimeout(() => router.replace("/"), 1200);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Invite could not be used"),
      )
      .finally(() => setAccepting(false));
  }, [inviteCode, qc, router, toast]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="mb-8">
        <Logo size={32} />
      </div>
      <div className="w-full max-w-md rounded-[16px] border border-border bg-surface p-8 text-center shadow-[var(--shadow-soft)]">
        {accepting ? (
          <>
            <h2 className="mb-1 text-2xl font-semibold">Joining group…</h2>
            <p className="text-text-secondary">Redeeming invite <code>{inviteCode}</code>.</p>
          </>
        ) : accepted ? (
          <>
            <h2 className="mb-1 text-2xl font-semibold">You&apos;re in.</h2>
            <p className="text-text-secondary">Taking you to {accepted}…</p>
          </>
        ) : (
          <>
            <h2 className="mb-1 text-2xl font-semibold">Can&apos;t use this invite</h2>
            <p className="mb-6 text-text-secondary">{error}</p>
            <Button onClick={() => router.replace("/")}>Go to gallery</Button>
          </>
        )}
      </div>
    </main>
  );
}
