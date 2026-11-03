"use client";

export default function Pagination({
  page, totalPages, onPageChange, total, limit, disabled = false,
}: {
  page: number; totalPages: number; onPageChange: (page: number) => void;
  total?: number; limit?: number; disabled?: boolean;
}) {
  if (totalPages <= 1) return null;
  const range = total !== undefined && limit ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total} · ` : "";

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-3 pt-10">
      <button disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}
        className="rounded-xl border border-ink/15 px-4 py-2 text-sm text-ink hover:border-ink/40 disabled:opacity-40 transition">
        Previous
      </button>
      <span className="text-sm text-muted" aria-live="polite">{range}Page {page} of {totalPages}</span>
      <button disabled={disabled || page >= totalPages} onClick={() => onPageChange(page + 1)}
        className="rounded-xl bg-btn px-4 py-2 text-sm text-white hover:bg-btn-soft disabled:opacity-40 transition">
        Next
      </button>
    </nav>
  );
}