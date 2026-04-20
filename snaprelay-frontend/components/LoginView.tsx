"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "./Button";
import { Input } from "./Input";
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
    </form>
  );
}

export function LoginView() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-0">
          <Image
            src="/logo.png"
            alt="Nexis"
            width={120}
            height={120}
            priority
            className="object-contain"
          />
          <span
            className="text-2xl font-bold tracking-tight"
            style={{
              marginTop: -16,
              background: "var(--gradient-brand)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Nexis
          </span>
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
