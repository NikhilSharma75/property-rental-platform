import { PaymentStatus } from "@/lib/api";

const STYLES: Record<PaymentStatus, string> = {
  PENDING:    "bg-gold/12 text-gold-ink border-gold/35",
  PROCESSING: "bg-primary-soft text-primary border-primary/30",
  SUCCEEDED:  "bg-emerald-50 text-emerald-800 border-emerald-200",
  FAILED:     "bg-red-50 text-red-700 border-red-200",
  REFUNDED:   "bg-slate-100 text-slate-600 border-slate-200",
  CANCELLED:  "bg-slate-100 text-slate-600 border-slate-200",
};

const LABEL: Record<PaymentStatus, string> = {
  PENDING: "Unpaid",
  PROCESSING: "Processing",
  SUCCEEDED: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`inline-flex items-center rounded-xl border px-2 py-0.5 text-xs font-medium tracking-wide ${STYLES[status]}`}>
      {LABEL[status]}
    </span>
  );
}
