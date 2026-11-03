"use client";

import { errorMessage } from "@/lib/errors";
import { FormEvent, useState } from "react";
import { api, FullProfile } from "@/lib/api";
import { TextInput, TextAreaField } from "./FormField";
import { InlineBanner } from "./InlineBanner";
import { validateFullName, validateDateOfBirth, validateBio } from "@/lib/profileValidation";

export function PersonalInfoForm({
  profile,
  onSaved,
}: {
  profile: FullProfile;
  onSaved: (profile: FullProfile) => void;
}) {
  const [fullName, setFullName] = useState(profile.full_name);
  const [dateOfBirth, setDateOfBirth] = useState(profile.date_of_birth ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(
    null
  );

  const dirty =
    fullName !== profile.full_name ||
    dateOfBirth !== (profile.date_of_birth ?? "") ||
    bio !== (profile.bio ?? "");

  function validate(): boolean {
    const next: Record<string, string> = {};
    const nameError = validateFullName(fullName);
    if (nameError) next.fullName = nameError;
    const dobError = validateDateOfBirth(dateOfBirth);
    if (dobError) next.dateOfBirth = dobError;
    const bioError = validateBio(bio);
    if (bioError) next.bio = bioError;
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
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth || null,
        bio: bio.trim() || null,
      });
      onSaved(updated);
      setStatus({ kind: "success", message: "Personal information saved." });
    } catch (err) {
      setStatus({ kind: "error", message: errorMessage(err, "Failed to save changes.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <TextInput
        id="fullName"
        label="Full name"
        value={fullName}
        onChange={setFullName}
        required
        autoComplete="name"
        error={errors.fullName}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TextInput
          id="email"
          label="Email"
          value={profile.email}
          onChange={() => {}}
          disabled
          hint="Contact support to change your email."
        />
        <TextInput
          id="dateOfBirth"
          label="Date of birth"
          type="date"
          value={dateOfBirth}
          onChange={setDateOfBirth}
          error={errors.dateOfBirth}
        />
      </div>

      <TextAreaField
        id="bio"
        label="Bio"
        value={bio}
        onChange={setBio}
        maxLength={500}
        placeholder="A short introduction other members of RentEase will see."
        error={errors.bio}
      />

      {status && <InlineBanner kind={status.kind} message={status.message} />}

      <button
        type="submit"
        disabled={saving || !dirty}
        className="w-full rounded-lg bg-btn py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 sm:w-auto sm:px-6"
      >
        {saving ? "Saving…" : "Save personal information"}
      </button>
    </form>
  );
}
