"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck, Mail } from "lucide-react";
import { api } from "@/lib/api";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      await api.forgotPassword(email);
    } catch {
      // Swallow API errors on purpose: the response must look identical whether or not the account exists
      // (prevents account enumeration). Only a network failure is worth surfacing.
      if (!navigator.onLine) { setError("You appear to be offline."); setLoading(false); return; }
    }
    setSent(true); setLoading(false);
  }

  return (
    <AuthShell
      title={sent ? "Check your inbox" : "Reset your password"}
      subtitle={sent ? undefined : "Enter your email and we'll send you a reset link."}
      footer={<Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-ink hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Back to login</Link>}
    >
      {sent ? (
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/12 text-success"><MailCheck className="h-7 w-7" /></span>
          <p className="mt-4 text-sm leading-relaxed text-muted-2">
            If an account exists for <strong className="text-ink">{email}</strong>, a reset link is on its way. It expires in 1 hour and works once.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label htmlFor="fp-email" className="field-label">Email address</label>
            <div className="flex items-center gap-2.5 rounded-xl border border-ink/15 bg-surface/50 px-3.5 py-2.5 transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
              <Mail className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <input id="fp-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted/60" />
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">Send reset link</Button>
        </form>
      )}
    </AuthShell>
  );
}
