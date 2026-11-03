"use client";

import { errorMessage } from "@/lib/errors";
import { FormEvent, useState } from "react";
import { api, FullProfile } from "@/lib/api";
import { TextInput } from "./FormField";
import { InlineBanner } from "./InlineBanner";
import { validatePhone, validatePostalCode } from "@/lib/profileValidation";

export function ContactDetailsForm({
  profile,
  onSaved,
}: {
  profile: FullProfile;
  onSaved: (profile: FullProfile) => void;
}) {
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [alternatePhone, setAlternatePhone] = useState(profile.alternate_phone ?? "");
  const [addressLine1, setAddressLine1] = useState(profile.address_line1 ?? "");
  const [addressLine2, setAddressLine2] = useState(profile.address_line2 ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [state, setState] = useState(profile.state ?? "");
  const [postalCode, setPostalCode] = useState(profile.postal_code ?? "");
  const [country, setCountry] = useState(profile.country ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(
    null
  );

  const fields: Array<[string, string]> = [
    ["phone", phone],
    ["alternatePhone", alternatePhone],
    ["addressLine1", addressLine1],
    ["addressLine2", addressLine2],
    ["city", city],
    ["state", state],
    ["postalCode", postalCode],
    ["country", country],
  ];
  const original: Record<string, string> = {
    phone: profile.phone ?? "",
    alternatePhone: profile.alternate_phone ?? "",
    addressLine1: profile.address_line1 ?? "",
    addressLine2: profile.address_line2 ?? "",
    city: profile.city ?? "",
    state: profile.state ?? "",
    postalCode: profile.postal_code ?? "",
    country: profile.country ?? "",
  };
  const dirty = fields.some(([key, value]) => value !== original[key]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    const phoneError = validatePhone(phone);
    if (phoneError) next.phone = phoneError;
    const altPhoneError = validatePhone(alternatePhone);
    if (altPhoneError) next.alternatePhone = altPhoneError;
    const postalError = validatePostalCode(postalCode);
    if (postalError) next.postalCode = postalError;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (!validate()) return;

    setSaving(true);
    try {
      const { profile: updated } = await api.updateProfile({
        phone: phone.trim() || null,
        alternatePhone: alternatePhone.trim() || null,
        addressLine1: addressLine1.trim() || null,
        addressLine2: addressLine2.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        postalCode: postalCode.trim() || null,
        country: country.trim() || null,
      });
      onSaved(updated);
      setStatus({ kind: "success", message: "Contact details saved." });
    } catch (err) {
      setStatus({ kind: "error", message: errorMessage(err, "Failed to save changes.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TextInput
          id="phone"
          label="Phone"
          type="tel"
          value={phone}
          onChange={setPhone}
          placeholder="(555) 123-4567"
          autoComplete="tel"
          error={errors.phone}
        />
        <TextInput
          id="alternatePhone"
          label="Alternate phone"
          type="tel"
          value={alternatePhone}
          onChange={setAlternatePhone}
          placeholder="Optional"
          error={errors.alternatePhone}
        />
      </div>

      <TextInput
        id="addressLine1"
        label="Address line 1"
        value={addressLine1}
        onChange={setAddressLine1}
        placeholder="123 Maple Street"
        autoComplete="address-line1"
      />
      <TextInput
        id="addressLine2"
        label="Address line 2"
        value={addressLine2}
        onChange={setAddressLine2}
        placeholder="Apt, suite, unit (optional)"
        autoComplete="address-line2"
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TextInput id="city" label="City" value={city} onChange={setCity} autoComplete="address-level2" />
        <TextInput
          id="state"
          label="State / Province"
          value={state}
          onChange={setState}
          autoComplete="address-level1"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TextInput
          id="postalCode"
          label="Postal code"
          value={postalCode}
          onChange={setPostalCode}
          autoComplete="postal-code"
          error={errors.postalCode}
        />
        <TextInput id="country" label="Country" value={country} onChange={setCountry} autoComplete="country-name" />
      </div>

      {status && <InlineBanner kind={status.kind} message={status.message} />}

      <button
        type="submit"
        disabled={saving || !dirty}
        className="w-full rounded-lg bg-btn py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 sm:w-auto sm:px-6"
      >
        {saving ? "Saving…" : "Save contact details"}
      </button>
    </form>
  );
}
