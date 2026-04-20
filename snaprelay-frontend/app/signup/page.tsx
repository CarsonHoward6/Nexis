"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";

type Stage = "register" | "confirm";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useAuth();
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.signUp(email, password);
      setStage("confirm");
      toast("Check your email for the verification code", "info");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setLoading(false);
    }
  }

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.confirmSignUp(email, code);
      await signIn(email, password);
      toast("Account created", "success");
      router.replace(params.get("next") || "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  if (stage === "register") {
    return (
      <form onSubmit={onRegister} className="flex flex-col gap-5">
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
          autoComplete="new-password"
          required
          minLength={8}
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error ?? undefined}
        />
        <Button type="submit" loading={loading} size="lg">
          Create account
        </Button>
        <p className="text-sm text-text-secondary">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-accent hover:brightness-110 underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={onConfirm} className="flex flex-col gap-5">
      <p className="text-sm text-text-secondary">
        Enter the 6-digit code we sent to{" "}
        <span className="text-text-primary">{email}</span>.
      </p>
      <Input
        label="Verification code"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        error={error ?? undefined}
      />
      <Button type="submit" loading={loading} size="lg">
        Verify &amp; continue
      </Button>
      <button
        type="button"
        className="text-sm text-text-muted hover:text-text-secondary"
        onClick={() => setStage("register")}
      >
        ← Back
      </button>
    </form>
  );
}

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 flex items-center justify-center">
          <Logo size={32} />
        </div>
        <div className="rounded-[16px] border border-border bg-surface p-8 shadow-[var(--shadow-soft)]">
          <h2 className="mb-1 text-2xl font-semibold">Create your account</h2>
          <p className="mb-6 text-sm text-text-secondary">
            Start uploading and collaborating in seconds.
          </p>
          <Suspense>
            <SignupForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
