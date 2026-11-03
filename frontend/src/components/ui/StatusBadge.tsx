import { ApplicationStatus } from "@/lib/api";

const STYLES: Record<ApplicationStatus, string> = {
  EXPIRED: "bg-slate-100 text-slate-600 border-slate-200",
  PENDING:   "bg-gold/12 text-gold-ink border-gold/35",
  APPROVED:  "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED:  "bg-red-50 text-red-700 border-red-200",
  WITHDRAWN: "bg-slate-100 text-slate-600 border-slate-200",
};

const LABEL: Record<ApplicationStatus, string> = {
  EXPIRED: "Expired",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-xl border px-2 py-0.5 text-xs font-medium tracking-wide ${STYLES[status]}`}
    >
      {LABEL[status]}
    </span>
  );
}