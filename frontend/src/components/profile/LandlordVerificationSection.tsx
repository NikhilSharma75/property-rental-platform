"use client";

import { errorMessage } from "@/lib/errors";
import { FormEvent, useState } from "react";
import { api, GovernmentIdType, LandlordVerification } from "@/lib/api";
import { TextInput, SelectField } from "./FormField";
import { FileInput } from "./FileInput";
import { InlineBanner } from "./InlineBanner";
import { StatusBadge } from "./StatusBadge";

const ID_TYPE_OPTIONS: { value: GovernmentIdType; label: string }[] = [
  { value: "PASSPORT", label: "Passport" },
  { value: "NATIONAL_ID", label: "National ID card" },
  { value: "DRIVERS_LICENSE", label: "Driver's license" },
];

export function LandlordVerificationSection({
  verification,
  onSaved,
}: {
  verification: LandlordVerification;
  onSaved: (verification: LandlordVerification) => void;
}) {
  const [governmentIdType, setGovernmentIdType] = useState<string>(
    verification.government_id_type ?? ""
  );
  const [governmentIdNumber, setGovernmentIdNumber] = useState(
    verification.government_id_number ?? ""
  );
  const [businessName, setBusinessName] = useState(verification.business_name ?? "");
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState(
    verification.business_registration_number ?? ""
  );
  const [taxId, setTaxId] = useState(verification.tax_id ?? "");
  const [governmentIdDocument, setGovernmentIdDocument] = useState<File | null>(null);
  const [proofOfOwnership, setProofOfOwnership] = useState<File | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(
    null
  );

  const hasExistingDocument = !!verification.government_id_document_url;
  const editable = verification.status !== "PENDING" && verification.status !== "VERIFIED";

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!governmentIdType) next.governmentIdType = "Select an ID type.";
    if (!governmentIdNumber.trim() || governmentIdNumber.trim().length < 3) {
      next.governmentIdNumber = "Enter a valid ID number.";
    }
    if (!governmentIdDocument && !hasExistingDocument) {
      next.governmentIdDocument = "Upload a copy of your government ID.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (!validate()) return;

    setSaving(true);
    try {
      const { verification: updated } = await api.submitLandlordVerification({
        governmentIdType: governmentIdType as GovernmentIdType,
        governmentIdNumber: governmentIdNumber.trim(),
        businessName: businessName.trim() || null,
        businessRegistrationNumber: businessRegistrationNumber.trim() || null,
        taxId: taxId.trim() || null,
        governmentIdDocument,
        proofOfOwnership,
      });
      onSaved(updated);
      setGovernmentIdDocument(null);
      setProofOfOwnership(null);
      setStatus({
        kind: "success",
        message: "Verification details submitted. We'll review them shortly.",
      });
    } catch (err) {
      setStatus({ kind: "error", message: errorMessage(err, "Failed to submit verification.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-2">
          Verified landlords get a badge tenants can see on every listing.
        </p>
        <StatusBadge status={verification.status} />
      </div>

      {verification.status === "REJECTED" && verification.rejection_reason && (
        <InlineBanner
          kind="error"
          message={`Your last submission needs changes: ${verification.rejection_reason}`}
        />
      )}
      {verification.status === "PENDING" && (
        <InlineBanner
          kind="success"
          message="Your verification is being reviewed. We'll notify you once it's complete."
        />
      )}
      {verification.status === "VERIFIED" && (
        <InlineBanner kind="success" message="Your landlord identity is verified." />
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField
            id="governmentIdType"
            label="Government ID type"
            value={governmentIdType}
            onChange={setGovernmentIdType}
            options={ID_TYPE_OPTIONS}
            placeholder="Select an ID type"
            required
            disabled={!editable}
            error={errors.governmentIdType}
          />
          <TextInput
            id="governmentIdNumber"
            label="Government ID number"
            value={governmentIdNumber}
            onChange={setGovernmentIdNumber}
            required
            disabled={!editable}
            error={errors.governmentIdNumber}
          />
        </div>

        <FileInput
          id="governmentIdDocument"
          label="Government ID document"
          required
          file={governmentIdDocument}
          existingUrl={verification.government_id_document_url}
          error={errors.governmentIdDocument}
          onChange={(file, err) => {
            setGovernmentIdDocument(file);
            setErrors((prev) => ({ ...prev, governmentIdDocument: err ?? "" }));
          }}
        />

        <div className="border-t border-ink/10 pt-5">
          <p className="mb-4 text-sm font-medium text-ink">
            Business details <span className="font-normal text-muted">(if applicable)</span>
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextInput
              id="businessName"
              label="Business name"
              value={businessName}
              onChange={setBusinessName}
              disabled={!editable}
            />
            <TextInput
              id="businessRegistrationNumber"
              label="Business registration number"
              value={businessRegistrationNumber}
              onChange={setBusinessRegistrationNumber}
              disabled={!editable}
            />
          </div>
          <div className="mt-5">
            <TextInput
              id="taxId"
              label="Tax ID"
              value={taxId}
              onChange={setTaxId}
              disabled={!editable}
            />
          </div>
          <div className="mt-5">
            <FileInput
              id="proofOfOwnership"
              label="Proof of property ownership"
              file={proofOfOwnership}
              existingUrl={verification.proof_of_ownership_url}
              onChange={(file, err) => {
                setProofOfOwnership(file);
                setErrors((prev) => ({ ...prev, proofOfOwnership: err ?? "" }));
              }}
            />
          </div>
        </div>

        {status && <InlineBanner kind={status.kind} message={status.message} />}

        {editable && (
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-btn py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 sm:w-auto sm:px-6"
          >
            {saving
              ? "Submitting…"
              : verification.status === "REJECTED"
                ? "Resubmit verification"
                : "Submit for verification"}
          </button>
        )}
      </form>
    </div>
  );
}
