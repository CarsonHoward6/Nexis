"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export function AuthGate({
  children,
  redirectTo = "/login",
}: {
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const next = typeof window !== "undefined" ? window.location.pathname : "/";
      router.replace(`${redirectTo}?next=${encodeURIComponent(next)}`);
    }
  }, [user, loading, router, redirectTo]);

  if (loading || !user) {
    return <div className="min-h-screen bg-bg" />;
  }
  return <>{children}</>;
}
