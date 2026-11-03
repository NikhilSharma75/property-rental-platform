"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const redirectTo = params.get("redirectTo") ?? params.get("redirect") ?? undefined;
      await login(email, password, redirectTo);
    } catch (err) {
      // Deliberately generic: never reveal whether the email exists.
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to continue to your dashboard."
      footer={<>New to RentEase? <Link href="/register" className="font-medium text-ink hover:underline">Create an account</Link></>}
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate={false}>
        <div>
          <label htmlFor="email" className="field-label">Email address</label>
          <div className="flex items-center gap-2.5 rounded-xl border border-ink/15 bg-surface/50 px-3.5 py-2.5 transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
            <Mail className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            <input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required
              className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted/60" />
          </div>
        </div>

        <PasswordField value={password} onChange={setPassword}
          rightLabel={<Link href="/forgot-password" className="text-sm text-primary hover:underline">Forgot password?</Link>} />

        {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <Button type="submit" loading={loading} className="w-full">{loading ? "Logging in…" : "Log in"}</Button>
      </form>
    </AuthShell>
  );
}
