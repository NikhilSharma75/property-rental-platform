"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { reportApi, ReportKindInput, ReportTargetType } from "@/lib/api";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";



export function ReportDialog({
  open, kind, targetType, targetId, title, description, defaultSubject = "", onClose, onSent,
}: {
  open: boolean; kind: ReportKindInput; targetType: ReportTargetType; targetId: string;
  title: string; description?: string; defaultSubject?: string;
  onClose: () => void; onSent?: () => void;
}) {
  const [subject, setSubject] = useState(defaultSubject);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function close() {
    setSubject(defaultSubject); setDetails(""); setError(null); setSent(false);
    onClose();
  }

  async function submit() {
    const s = subject.trim();
    if (s.length < 3) { setError("Add a short subject (at least 3 characters)."); return; }
    setError(null);
    try {
      await reportApi.create({ kind, targetType, targetId, subject: s, details: details.trim() || undefined });
      setSent(true);
      onSent?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send your report. Please try again.");
    }
  }

  return (
    <ConfirmDialog
      open={open} tone="primary" icon={<Flag className="h-5 w-5" />}
      title={sent ? "Report sent" : title}
      description={sent ? "Thanks. An admin will review it, and you'll be notified when it's resolved." : description}
      confirmLabel={sent ? "Done" : "Send report"} cancelLabel={sent ? "Close" : "Cancel"}
      onCancel={close} onConfirm={sent ? async () => close() : submit}
    >
      {!sent && (
        <div className="space-y-3">
          <div>
            <label className="field-label" htmlFor="rp-subject">Subject</label>
            <input id="rp-subject" className="field-input" maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="rp-details">Details <span className="text-muted">(optional)</span></label>
            <textarea id="rp-details" className="field-input" rows={4} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} />
            <p className="mt-1 text-right text-xs text-muted">{details.length}/2000</p>
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </div>
      )}
    </ConfirmDialog>
  );
}

