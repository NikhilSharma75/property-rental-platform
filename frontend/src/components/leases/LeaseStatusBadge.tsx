import { LeaseStatus } from "@/lib/api";

const STYLES: Record<LeaseStatus, string> = {
  DRAFT:      "bg-gold/12 text-gold-ink border-gold/35",
  ACTIVE:     "bg-emerald-50 text-emerald-800 border-emerald-200",
  EXPIRED:    "bg-slate-100 text-slate-600 border-slate-200",
  TERMINATED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED:  "bg-slate-100 text-slate-600 border-slate-200",
};

const LABEL: Record<LeaseStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  EXPIRED: "Expired",
  TERMINATED: "Terminated",
  CANCELLED: "Cancelled",
};

export function LeaseStatusBadge({ status }: { status: LeaseStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-xl border px-2 py-0.5 text-xs font-medium tracking-wide ${STYLES[status]}`}
    >
      {LABEL[status]}
    </span>
  );
}