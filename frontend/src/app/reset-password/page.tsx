"use client";

import { Suspense, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordField, passwordScore } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/Button";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError("Passwords don't match.");
    if (passwordScore(password) < 2) return setError("Choose a stronger password.");
    setLoading(true);
    try {
      await api.resetPassword({ token, password });
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "This link is invalid or has expired.");
    } finally { setLoading(false); }
  }

  if (!token) {
    return (
      <AuthShell title="Link missing" subtitle="This reset link is incomplete.">
        <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">Request a new link</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={done ? "Password updated" : "Choose a new password"}
      footer={<Link href="/login" className="font-medium text-ink hover:underline">Back to login</Link>}>
      {done ? (
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/12 text-success"><CheckCircle2 className="h-7 w-7" /></span>
          <p className="mt-4 text-sm text-muted-2">All set. Redirecting you to login…</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <PasswordField label="New password" value={password} onChange={setPassword} autoComplete="new-password" showMeter />
          <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">Update password</Button>
        </form>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={null}><ResetForm /></Suspense>;
}
