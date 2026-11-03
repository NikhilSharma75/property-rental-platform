// "use client";

// import { useState } from "react";
// import { X, Loader2 } from "lucide-react";
// import { applicationApi, CreateApplicationInput } from "@/lib/api";
// import { FileUpload } from "@/components/ui/FileUpload";

// interface ApplyModalProps {
//   propertyId: string;
//   propertyTitle: string;
//   open: boolean;
//   onClose: () => void;
//   onSubmitted: (applicationId: string) => void;
// }

// export function ApplyModal({ propertyId, propertyTitle, open, onClose, onSubmitted }: ApplyModalProps) {
//   const [submitting, setSubmitting] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   const [form, setForm] = useState({
//     desiredMoveInDate: "",
//     leaseDurationMonths: 12,
//     monthlyIncome: "",
//     employmentStatus: "",
//     employerName: "",
//     additionalNotes: "",
//   });

//   const [idProof, setIdProof] = useState<File | null>(null);
//   const [incomeProof, setIncomeProof] = useState<File | null>(null);
//   const [referenceLetter, setReferenceLetter] = useState<File | null>(null);

//   if (!open) return null;

//   async function handleSubmit(e: React.FormEvent) {
//     e.preventDefault();
//     setError(null);

//     if (!form.desiredMoveInDate) { setError("Please choose a move-in date."); return; }
//     if (form.leaseDurationMonths < 1 || form.leaseDurationMonths > 60) {
//       setError("Lease duration must be between 1 and 60 months.");
//       return;
//     }

//     const payload: CreateApplicationInput = {
//       propertyId,
//       desiredMoveInDate: form.desiredMoveInDate,
//       leaseDurationMonths: Number(form.leaseDurationMonths),
//       monthlyIncome: form.monthlyIncome ? Number(form.monthlyIncome) : undefined,
//       employmentStatus: form.employmentStatus || undefined,
//       employerName: form.employerName || undefined,
//       additionalNotes: form.additionalNotes || undefined,
//     };

//     setSubmitting(true);
//     try {
//       const { application } = await applicationApi.create(payload);

//       if (idProof || incomeProof || referenceLetter) {
//         await applicationApi.uploadDocuments(application.id, {
//           idProof: idProof ?? undefined,
//           incomeProof: incomeProof ?? undefined,
//           referenceLetter: referenceLetter ?? undefined,
//         });
//       }

//       onSubmitted(application.id);
//     } catch (err) {
//       setError(err instanceof Error ? err.message : "Failed to submit application.");
//     } finally {
//       setSubmitting(false);
//     }
//   }

//   return (
//     <div
//       className="fixed inset-0 z-50 flex items-center justify-center bg-night/60 p-4"
//       onClick={onClose}
//     >
//       <div
//         className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl glass-strong shadow-2xl"
//         onClick={(e) => e.stopPropagation()}
//       >
//         <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 glass-strong px-6 py-4">
//           <div>
//             <h2 className="text-lg font-semibold text-ink">Apply for this property</h2>
//             <p className="text-sm text-slate-500">{propertyTitle}</p>
//           </div>
//           <button
//             onClick={onClose}
//             disabled={submitting}
//             className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
//             aria-label="Close"
//           >
//             <X className="h-5 w-5" />
//           </button>
//         </div>

//         <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
//           <div className="grid gap-4 sm:grid-cols-2">
//             <div>
//               <label className="mb-1.5 block text-sm font-medium text-ink">
//                 Desired move-in date <span className="text-red-500">*</span>
//               </label>
//               <input
//                 type="date"
//                 required
//                 value={form.desiredMoveInDate}
//                 min={new Date().toISOString().slice(0, 10)}
//                 onChange={(e) => setForm((f) => ({ ...f, desiredMoveInDate: e.target.value }))}
//                 className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
//               />
//             </div>
//             <div>
//               <label className="mb-1.5 block text-sm font-medium text-ink">
//                 Lease duration (months) <span className="text-red-500">*</span>
//               </label>
//               <input
//                 type="number"
//                 min={1}
//                 max={60}
//                 required
//                 value={form.leaseDurationMonths}
//                 onChange={(e) => setForm((f) => ({ ...f, leaseDurationMonths: Number(e.target.value) }))}
//                 className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
//               />
//             </div>
//           </div>

//           <div className="grid gap-4 sm:grid-cols-2">
//             <div>
//               <label className="mb-1.5 block text-sm font-medium text-ink">
//                 Monthly income (optional)
//               </label>
//               <input
//                 type="number"
//                 min={0}
//                 step="0.01"
//                 value={form.monthlyIncome}
//                 onChange={(e) => setForm((f) => ({ ...f, monthlyIncome: e.target.value }))}
//                 className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
//               />
//             </div>
//             <div>
//               <label className="mb-1.5 block text-sm font-medium text-ink">
//                 Employment status (optional)
//               </label>
//               <input
//                 type="text"
//                 maxLength={100}
//                 placeholder="e.g. Full-time"
//                 value={form.employmentStatus}
//                 onChange={(e) => setForm((f) => ({ ...f, employmentStatus: e.target.value }))}
//                 className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
//               />
//             </div>
//           </div>

//           <div>
//             <label className="mb-1.5 block text-sm font-medium text-ink">
//               Employer name (optional)
//             </label>
//             <input
//               type="text"
//               maxLength={150}
//               value={form.employerName}
//               onChange={(e) => setForm((f) => ({ ...f, employerName: e.target.value }))}
//               className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
//             />
//           </div>

//           <div>
//             <label className="mb-1.5 block text-sm font-medium text-ink">
//               Additional notes (optional)
//             </label>
//             <textarea
//               rows={3}
//               maxLength={1000}
//               value={form.additionalNotes}
//               onChange={(e) => setForm((f) => ({ ...f, additionalNotes: e.target.value }))}
//               className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
//             />
//           </div>

//           <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
//             <p className="text-sm font-medium text-ink">Supporting documents (optional)</p>
//             <FileUpload label="ID proof" value={idProof} onChange={setIdProof} disabled={submitting} />
//             <FileUpload label="Income proof" value={incomeProof} onChange={setIncomeProof} disabled={submitting} />
//             <FileUpload label="Reference letter" value={referenceLetter} onChange={setReferenceLetter} disabled={submitting} />
//           </div>

//           {error && (
//             <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
//               {error}
//             </div>
//           )}

//           <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
//             <button
//               type="button"
//               onClick={onClose}
//               disabled={submitting}
//               className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
//             >
//               Cancel
//             </button>
//             <button
//               type="submit"
//               disabled={submitting}
//               className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
//             >
//               {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
//               {submitting ? "Submitting…" : "Submit application"}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }


///////
"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { applicationApi, publicPropertyApi, CreateApplicationInput, PublicUnit } from "@/lib/api";
import { FileUpload } from "@/components/ui/FileUpload";
import { formatMoney } from "@/lib/format";

interface ApplyModalProps {
  propertyId: string;
  propertyTitle: string;
  open: boolean;
  onClose: () => void;
  onSubmitted: (applicationId: string) => void;
}

type UnitsState = "loading" | "ready" | "error";

export function ApplyModal({ propertyId, propertyTitle, open, onClose, onSubmitted }: ApplyModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    desiredMoveInDate: "",
    leaseDurationMonths: 12,
    monthlyIncome: "",
    employmentStatus: "",
    employerName: "",
    additionalNotes: "",
  });

  const [idProof, setIdProof] = useState<File | null>(null);
  const [incomeProof, setIncomeProof] = useState<File | null>(null);
  const [referenceLetter, setReferenceLetter] = useState<File | null>(null);

  // Multi-unit buildings: the tenant must choose one AVAILABLE unit.
  const [unitsState, setUnitsState] = useState<UnitsState>("loading");
  const [hasUnits, setHasUnits] = useState(false);
  const [units, setUnits] = useState<PublicUnit[]>([]);
  const [unitId, setUnitId] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    publicPropertyApi
      .availableUnits(propertyId)
      .then((r) => {
        if (cancelled) return;
        setHasUnits(r.hasUnits);
        setUnits(r.units);
        setUnitsState("ready");
      })
      .catch(() => {
        if (!cancelled) setUnitsState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [open, propertyId]);

  if (!open) return null;

  const noUnitFree = unitsState === "ready" && hasUnits && units.length === 0;
  const blocked = unitsState === "loading" || unitsState === "error" || noUnitFree;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (hasUnits && !unitId) { setError("Please choose a unit."); return; }
    if (!form.desiredMoveInDate) { setError("Please choose a move-in date."); return; }
    if (form.leaseDurationMonths < 1 || form.leaseDurationMonths > 60) {
      setError("Lease duration must be between 1 and 60 months.");
      return;
    }

    const payload: CreateApplicationInput = {
      propertyId,
      unitId: hasUnits ? unitId : undefined,
      desiredMoveInDate: form.desiredMoveInDate,
      leaseDurationMonths: Number(form.leaseDurationMonths),
      monthlyIncome: form.monthlyIncome ? Number(form.monthlyIncome) : undefined,
      employmentStatus: form.employmentStatus || undefined,
      employerName: form.employerName || undefined,
      additionalNotes: form.additionalNotes || undefined,
    };

    setSubmitting(true);
    try {
      const { application } = await applicationApi.create(payload);

      if (idProof || incomeProof || referenceLetter) {
        await applicationApi.uploadDocuments(application.id, {
          idProof: idProof ?? undefined,
          incomeProof: incomeProof ?? undefined,
          referenceLetter: referenceLetter ?? undefined,
        });
      }

      onSubmitted(application.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit application.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-night/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl glass-strong shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 glass-strong px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Apply for this property</h2>
            <p className="text-sm text-slate-500">{propertyTitle}</p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          {unitsState === "loading" && (
            <p className="text-sm text-slate-500">Checking availability…</p>
          )}
          {unitsState === "error" && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Couldn&apos;t load this property&apos;s availability. Close this window and try again.
            </div>
          )}
          {noUnitFree && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Every unit in this building is currently reserved or occupied, so applications are closed for now.
            </div>
          )}

          {unitsState === "ready" && hasUnits && units.length > 0 && (
            <div>
              <label htmlFor="apply-unit" className="mb-1.5 block text-sm font-medium text-ink">
                Unit <span className="text-red-500">*</span>
              </label>
              <select
                id="apply-unit"
                required
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select a unit…</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unit_label} · {u.bedrooms} bd / {u.bathrooms} ba · {formatMoney(u.rent_amount)}/mo
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Desired move-in date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={form.desiredMoveInDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setForm((f) => ({ ...f, desiredMoveInDate: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Lease duration (months) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={60}
                required
                value={form.leaseDurationMonths}
                onChange={(e) => setForm((f) => ({ ...f, leaseDurationMonths: Number(e.target.value) }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Monthly income (optional)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.monthlyIncome}
                onChange={(e) => setForm((f) => ({ ...f, monthlyIncome: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Employment status (optional)
              </label>
              <input
                type="text"
                maxLength={100}
                placeholder="e.g. Full-time"
                value={form.employmentStatus}
                onChange={(e) => setForm((f) => ({ ...f, employmentStatus: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">
              Employer name (optional)
            </label>
            <input
              type="text"
              maxLength={150}
              value={form.employerName}
              onChange={(e) => setForm((f) => ({ ...f, employerName: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">
              Additional notes (optional)
            </label>
            <textarea
              rows={3}
              maxLength={1000}
              value={form.additionalNotes}
              onChange={(e) => setForm((f) => ({ ...f, additionalNotes: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <p className="text-sm font-medium text-ink">Supporting documents (optional)</p>
            <FileUpload label="ID proof" value={idProof} onChange={setIdProof} disabled={submitting} />
            <FileUpload label="Income proof" value={incomeProof} onChange={setIncomeProof} disabled={submitting} />
            <FileUpload label="Reference letter" value={referenceLetter} onChange={setReferenceLetter} disabled={submitting} />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || blocked}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Submitting…" : "Submit application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

