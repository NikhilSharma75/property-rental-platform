"use client";

import { errorMessage } from "@/lib/errors";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { paymentApi, leaseApi, Payment, PaymentType, LeaseWithProperty } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatusBadge";
import { formatMoney } from "@/lib/format";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const inputCls =
  "w-full rounded-xl border border-ink/15 bg-surface/70 px-3 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function formatDate(s: string | null): string {
  if (!s) return "—";
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const money = (n: number, currency?: string | null) => formatMoney(n, { decimals: true, currency: currency ?? undefined });

const TYPE_LABEL: Record<PaymentType, string> = { RENT: "Rent", DEPOSIT: "Deposit", OTHER: "Payment" };

export default function PaymentsPageWrapper() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-ink">
          <p className="text-sm tracking-wide text-muted">Loading...</p>
        </main>
      }
    >
      <PaymentsPage />
    </Suspense>
  );
}

function PaymentsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [banner, setBanner] = useState<{ kind: "success" | "cancel"; text: string } | null>(null);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the Stripe redirect query param once
      setBanner({ kind: "success", text: "Payment received. It may take a few seconds to show as paid below." });
      router.replace("/dashboard/payments");
    } else if (checkout === "cancelled") {
      setBanner({ kind: "cancel", text: "Checkout was cancelled. No payment was made." });
      router.replace("/dashboard/payments");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (authLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink">
        <p className="text-sm tracking-wide text-muted">Loading...</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} eyebrow={user.role === "LANDLORD" ? "For landlords" : "For tenants"} title="Payments">
      <h1 className="text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[2.35rem]">Payments</h1>
      <p className="mt-2 max-w-lg text-[15px] text-muted-2">
        {user.role === "LANDLORD"
          ? "Invoice tenants for rent and deposits, and track who has paid."
          : "Pay rent and deposits, and keep a record of what you've paid."}
      </p>

      {banner && (
        <p
          role="status"
          className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
            banner.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-ink/15 bg-canvas text-muted-2"
          }`}
        >
          {banner.text}
        </p>
      )}

      {user.role === "LANDLORD" ? <LandlordPayments /> : <TenantPayments />}
    </AppShell>
  );
}

/* ---------- tenant view ---------- */

function TenantPayments() {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setError(null);
    try {
      const { payments } = await paymentApi.listMine();
      setPayments(payments);
    } catch (err) {
      setError(errorMessage(err, "Failed to load payments."));
      setPayments([]);
    }
  }

  async function handlePay(id: string) {
    setPayingId(id);
    setError(null);
    try {
      await paymentApi.payNow(id); // navigates away to Stripe on success
    } catch (err) {
      setError(errorMessage(err, "Failed to start checkout."));
      setPayingId(null);
    }
  }

  async function handleSync(id: string) {
    setSyncingId(id);
    setError(null);
    try {
      await paymentApi.sync(id);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Failed to check payment status."));
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDownload(kind: "invoice" | "receipt", id: string) {
    setDownloadingId(id);
    setError(null);
    try {
      if (kind === "invoice") await paymentApi.downloadInvoice(id);
      else await paymentApi.downloadReceipt(id);
    } catch (err) {
      setError(errorMessage(err, "Failed to download PDF."));
    } finally {
      setDownloadingId(null);
    }
  }

  const sorted = useMemo(() => {
    const rank = (p: Payment) => (p.status === "PENDING" || p.status === "FAILED" ? 0 : 1);
    return [...(payments ?? [])].sort((a, b) => rank(a) - rank(b) || +new Date(b.created_at) - +new Date(a.created_at));
  }, [payments]);

  if (error) {
    return (
      <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </p>
    );
  }

  if (payments === null) {
    return (
      <div className="mt-8 space-y-4" aria-busy="true" aria-label="Loading payments">
        {[0, 1].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-ink/8 glass" />
        ))}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-dashed border-ink/15 glass p-10 text-center">
        <p className="text-[15px] font-medium text-ink">No payments yet</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">Invoices your landlord sends you will show up here.</p>
      </div>
    );
  }


  

  return (
    <div className="mt-8 space-y-4">
      {sorted.map((p) => {
        // PROCESSING means a checkout was started but not completed. The API expires the stale
        // Stripe session and creates a fresh one, so it is safe to offer "resume" here.
        const payable = p.status === "PENDING" || p.status === "FAILED" || p.status === "PROCESSING";
        return (
          <article key={p.id} className={`rounded-xl border glass p-5 ${payable ? "border-ink/8 border-l-4 border-l-gold" : "border-ink/8"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{p.properties?.title ?? "Property"}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {TYPE_LABEL[p.type]}
                  {p.period ? ` · ${p.period}` : ""}
                  {p.description ? ` · ${p.description}` : ""}
                </p>
              </div>
              <PaymentStatusBadge status={p.status} />
            </div>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
              <p className="text-2xl font-semibold tabular-nums text-ink">{money(p.amount, p.currency)}</p>
              <div className="flex gap-6 text-sm">
                <div>
                  <p className="text-xs text-muted">Due</p>
                  <p className="font-medium text-ink">{formatDate(p.due_date)}</p>
                </div>
                {p.paid_at && (
                  <div>
                    <p className="text-xs text-muted">Paid</p>
                    <p className="font-medium text-ink">{formatDate(p.paid_at)}</p>
                  </div>
                )}
              </div>
            </div>

            {p.status === "FAILED" && p.failure_reason && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{p.failure_reason}</p>
            )}
            {p.status === "PROCESSING" && (
              <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm text-muted-2">
                Waiting on confirmation from Stripe. If you already paid, tap &quot;Refresh status&quot; below.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink/8 pt-4">
              {payable && (
                <button
                  onClick={() => handlePay(p.id)}
                  disabled={payingId === p.id}
                  className={`rounded-xl bg-btn px-5 py-2.5 text-sm font-medium text-white hover:bg-btn-soft disabled:opacity-50 ${focusRing}`}
                >
                  {payingId === p.id
                    ? "Redirecting to Stripe..."
                    : p.status === "FAILED"
                    ? "Try again"
                    : p.status === "PROCESSING"
                    ? "Resume payment"
                    : "Pay now"}
                </button>
              )}
              {p.status === "PROCESSING" && (
                <button
                  onClick={() => handleSync(p.id)}
                  disabled={syncingId === p.id}
                  className={`rounded-xl border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink hover:bg-ink/5 disabled:opacity-50 ${focusRing}`}
                >
                  {syncingId === p.id ? "Checking..." : "Refresh status"}
                </button>
              )}
              {p.status === "SUCCEEDED" && (
                <button
                  onClick={() => handleDownload("receipt", p.id)}
                  disabled={downloadingId === p.id}
                  className={`rounded-xl border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink hover:bg-ink/5 disabled:opacity-50 ${focusRing}`}
                >
                  {downloadingId === p.id ? "Preparing..." : "Download receipt"}
                </button>
              )}
              <button
                onClick={() => handleDownload("invoice", p.id)}
                disabled={downloadingId === p.id}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary-soft disabled:opacity-50 ${focusRing}`}
              >
                {downloadingId === p.id ? "Preparing..." : "Download invoice"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ---------- landlord view ---------- */

function LandlordPayments() {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [activeLeases, setActiveLeases] = useState<LeaseWithProperty[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [leaseId, setLeaseId] = useState("");
  const [type, setType] = useState<PaymentType>("RENT");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setError(null);
    try {
      const [payRes, leaseRes] = await Promise.all([paymentApi.listForLandlord(), leaseApi.listForLandlord()]);
      setPayments(payRes.payments);
      setActiveLeases(leaseRes.leases.filter((l) => l.status === "ACTIVE"));
    } catch (err) {
      setError(errorMessage(err, "Failed to load payments."));
      setPayments([]);
    }
  }

  function selectLease(id: string) {
    setLeaseId(id);
    const lease = activeLeases.find((l) => l.id === id);
    if (!lease) return;
    if (type === "RENT") setAmount(String(lease.rent_amount));
    if (type === "DEPOSIT") setAmount(String(lease.security_deposit));
  }

  function selectType(next: PaymentType) {
    setType(next);
    const lease = activeLeases.find((l) => l.id === leaseId);
    if (!lease) return;
    if (next === "RENT") setAmount(String(lease.rent_amount));
    if (next === "DEPOSIT") setAmount(String(lease.security_deposit));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!leaseId) return;
    setSubmitting(true);
    setError(null);
    try {
      await paymentApi.create({
        leaseId,
        type,
        amount: Number(amount),
        period: period || undefined,
        dueDate: dueDate || undefined,
        description: description || undefined,
      });
      setShowForm(false);
      setLeaseId("");
      setType("RENT");
      setAmount("");
      setPeriod("");
      setDueDate("");
      setDescription("");
      await load();
    } catch (err) {
      setError(errorMessage(err, "Failed to create invoice."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Cancel this invoice? The tenant will no longer be able to pay it.")) return;
    setCancellingId(id);
    setError(null);
    try {
      await paymentApi.cancel(id);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Failed to cancel invoice."));
    } finally {
      setCancellingId(null);
    }
  }

  async function handleDownload(kind: "invoice" | "receipt", id: string) {
    setDownloadingId(id);
    setError(null);
    try {
      if (kind === "invoice") await paymentApi.downloadInvoice(id);
      else await paymentApi.downloadReceipt(id);
    } catch (err) {
      setError(errorMessage(err, "Failed to download PDF."));
    } finally {
      setDownloadingId(null);
    }
  }

  const sorted = useMemo(
    () => [...(payments ?? [])].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [payments]
  );

  return (
    <>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-muted-2">Create invoices from your active leases and track who has paid.</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          aria-expanded={showForm}
          className={`rounded-xl bg-btn px-4 py-2.5 text-sm font-medium text-white hover:bg-btn-soft ${focusRing}`}
        >
          {showForm ? "Close" : "+ Create invoice"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {showForm && (
        <section className="mt-6 rounded-xl border border-ink/10 glass p-6">
          {activeLeases.length === 0 ? (
            <p className="text-sm text-muted">You don&apos;t have any active leases to invoice yet.</p>
          ) : (
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="pay-lease" className="text-sm font-medium text-ink">
                    Lease
                  </label>
                  <select id="pay-lease" required className={`${inputCls} mt-1.5`} value={leaseId} onChange={(e) => selectLease(e.target.value)}>
                    <option value="">Select an active lease...</option>
                    {activeLeases.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.properties?.title ?? "Property"} — {l.users?.full_name ?? l.users?.email ?? "Tenant"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="pay-type" className="text-sm font-medium text-ink">
                    Type
                  </label>
                  <select id="pay-type" className={`${inputCls} mt-1.5`} value={type} onChange={(e) => selectType(e.target.value as PaymentType)}>
                    <option value="RENT">Rent</option>
                    <option value="DEPOSIT">Security deposit</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="pay-amount" className="text-sm font-medium text-ink">
                    Amount
                  </label>
                  <input
                    id="pay-amount"
                    required
                    type="number"
                    min={0.01}
                    step="0.01"
                    className={`${inputCls} mt-1.5`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="pay-due" className="text-sm font-medium text-ink">
                    Due date
                  </label>
                  <input id="pay-due" type="date" className={`${inputCls} mt-1.5`} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="pay-period" className="text-sm font-medium text-ink">
                    Period (optional)
                  </label>
                  <input
                    id="pay-period"
                    placeholder="e.g. October 2026"
                    className={`${inputCls} mt-1.5`}
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="pay-desc" className="text-sm font-medium text-ink">
                  Note (optional)
                </label>
                <textarea id="pay-desc" rows={2} className={`${inputCls} mt-1.5`} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting || !leaseId || !amount}
                  className={`rounded-xl bg-btn px-5 py-2.5 text-sm font-medium text-white hover:bg-btn-soft disabled:opacity-50 ${focusRing}`}
                >
                  {submitting ? "Creating..." : "Create invoice"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className={`rounded-xl px-3 py-2.5 text-sm font-medium text-muted-2 hover:bg-ink/5 ${focusRing}`}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {payments === null ? (
        <div className="mt-8 space-y-4" aria-busy="true" aria-label="Loading payments">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-ink/8 glass" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No invoices created yet.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {sorted.map((p) => (
            <article key={p.id} className="rounded-xl border border-ink/8 glass p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{p.properties?.title ?? "Property"}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {p.users?.full_name ?? p.users?.email ?? "Tenant"} · {TYPE_LABEL[p.type]}
                    {p.period ? ` · ${p.period}` : ""}
                  </p>
                </div>
                <PaymentStatusBadge status={p.status} />
              </div>

              <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
                <p className="text-2xl font-semibold tabular-nums text-ink">{money(p.amount, p.currency)}</p>
                <div className="flex gap-6 text-sm">
                  <div>
                    <p className="text-xs text-muted">Due</p>
                    <p className="font-medium text-ink">{formatDate(p.due_date)}</p>
                  </div>
                  {p.paid_at && (
                    <div>
                      <p className="text-xs text-muted">Paid</p>
                      <p className="font-medium text-ink">{formatDate(p.paid_at)}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink/8 pt-4">
                <button
                  onClick={() => handleDownload("invoice", p.id)}
                  disabled={downloadingId === p.id}
                  className={`rounded-xl border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink hover:bg-ink/5 disabled:opacity-50 ${focusRing}`}
                >
                  {downloadingId === p.id ? "Preparing..." : "Download invoice"}
                </button>
                {p.status === "SUCCEEDED" && (
                  <button
                    onClick={() => handleDownload("receipt", p.id)}
                    disabled={downloadingId === p.id}
                    className={`rounded-xl px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary-soft disabled:opacity-50 ${focusRing}`}
                  >
                    Download receipt
                  </button>
                )}
                {(p.status === "PENDING" || p.status === "FAILED") && (
                  <button
                    onClick={() => handleCancel(p.id)}
                    disabled={cancellingId === p.id}
                    className={`ml-auto rounded-xl px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 ${focusRing}`}
                  >
                    {cancellingId === p.id ? "Cancelling..." : "Cancel invoice"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}