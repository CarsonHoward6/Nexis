"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "./Button";
import { Input } from "./Input";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { useToast } from "./Toast";

function LoginForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      toast("Welcome back", "success");
      const next = params.get("next") || "/";
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error ?? undefined}
      />
      <Button type="submit" loading={loading} size="lg">
        Sign in
      </Button>
      <p className="text-sm text-text-secondary">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="text-accent hover:brightness-110 underline-offset-4 hover:underline"
        >
          Create one
        </Link>
      </p>
      <p className="rounded-[12px] border border-border bg-surface px-4 py-3 text-xs text-text-muted">
        Demo: <span className="text-text-secondary">demo@nexis.dev</span> / password123
      </p>
    </form>
  );
}

export function LoginView() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 flex items-center justify-center">
          <Logo size={72} />
        </div>
        <div className="rounded-[16px] border border-border bg-surface p-8 shadow-[var(--shadow-soft)]">
          <h2 className="mb-1 text-2xl font-semibold">Sign in</h2>
          <p className="mb-6 text-sm text-text-secondary">
            Access your shared photo libraries.
          </p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
