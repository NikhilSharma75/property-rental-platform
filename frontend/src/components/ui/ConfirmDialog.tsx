"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

/** Accessible replacement for window.confirm(): Esc closes, focus lands on the confirm action. */
export function ConfirmDialog({
  open, title, description, confirmLabel = "Confirm", cancelLabel = "Cancel",
  tone = "danger", icon, children, onCancel, onConfirm,
}: {
  open: boolean; title: string; description?: string; confirmLabel?: string; cancelLabel?: string;
  tone?: "danger" | "primary"; icon?: ReactNode; children?: ReactNode;
  onCancel: () => void; onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open || typeof document === "undefined") return null;

  async function go() {
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  }

  return createPortal(
    <div
      role="dialog" aria-modal="true" aria-labelledby="confirm-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-night/60 p-4 backdrop-blur-sm"
      onClick={busy ? undefined : onCancel}
    >
      <div className="glass-strong w-full max-w-sm rounded-2xl border border-ink/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {icon && (
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone === "danger" ? "bg-danger/12 text-danger" : "bg-primary/12 text-primary"}`}>
            {icon}
          </div>
        )}
        <h2 id="confirm-title" className="mt-4 text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>}
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy}
            className="rounded-xl border border-ink/15 px-4 py-2 text-sm font-medium text-muted-2 transition hover:bg-ink/5 disabled:opacity-50">
            {cancelLabel}
          </button>
          <button type="button" onClick={go} disabled={busy} autoFocus
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60 ${tone === "danger" ? "bg-danger hover:brightness-110" : "bg-btn hover:bg-btn-soft"}`}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
