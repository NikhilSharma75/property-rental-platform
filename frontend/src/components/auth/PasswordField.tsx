"use client";
import { useId, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

export function passwordScore(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return s; // 0..4
}

export function PasswordField({
  label = "Password", value, onChange, autoComplete = "current-password", showMeter = false, rightLabel,
}: {
  label?: string; value: string; onChange: (v: string) => void;
  autoComplete?: "current-password" | "new-password"; showMeter?: boolean; rightLabel?: React.ReactNode;
}) {
  const id = useId();
  const [show, setShow] = useState(false);
  const score = passwordScore(value);
  const names = ["Too weak", "Weak", "Okay", "Good", "Strong"];
  const colors = ["bg-danger", "bg-danger", "bg-gold", "bg-success", "bg-success"];

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-[0.8125rem] font-medium text-ink">{label}</label>
        {rightLabel}
      </div>
      <div className="flex items-center gap-2.5 rounded-xl border border-ink/15 bg-surface/50 px-3.5 py-2.5 transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
        <Lock className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        <input id={id} type={show ? "text" : "password"} value={value} required minLength={8} maxLength={128}
          autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} placeholder="••••••••"
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted/60" />
        <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}
          className="shrink-0 text-muted hover:text-ink">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {showMeter && value && (
        <div className="mt-2" aria-live="polite">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < score ? colors[score] : "bg-ink/10"}`} />)}
          </div>
          <p className="mt-1 text-xs text-muted">{names[score]} — use 12+ characters with mixed case, a number and a symbol.</p>
        </div>
      )}
    </div>
  );
}
