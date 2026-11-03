"use client";

import { errorMessage } from "@/lib/errors";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { InlineBanner } from "./InlineBanner";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export function ProfileImageUpload({
  fullName,
  imageUrl,
  onChange,
}: {
  fullName: string;
  imageUrl: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const initials = fullName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function validate(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Please upload a JPEG, PNG, or WEBP image.";
    }
    if (file.size > MAX_BYTES) {
      return "Image must be 5MB or smaller.";
    }
    return null;
  }

  async function handleFile(file: File) {
    setError(null);
    setSuccess(null);

    const problem = validate(file);
    if (problem) {
      setError(problem);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setBusy(true);
    try {
      const { profile } = await api.uploadProfileImage(file);
      onChange(profile.profile_image_url);
      setSuccess("Profile photo updated.");
    } catch (err) {
      setError(errorMessage(err, "Failed to upload image."));
      setPreview(null);
    } finally {
      setBusy(false);
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function handleRemove() {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const { profile } = await api.deleteProfileImage();
      onChange(profile.profile_image_url);
      setPreview(null);
      setSuccess("Profile photo removed.");
    } catch (err) {
      setError(errorMessage(err, "Failed to remove image."));
    } finally {
      setBusy(false);
    }
  }

  const displayUrl = preview ?? imageUrl;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="relative shrink-0">
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayUrl}
            alt={`${fullName || "User"}'s profile photo`}
            className="h-24 w-24 rounded-full border border-ink/10 object-cover"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-btn text-xl font-semibold text-white">
            {initials || "?"}
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-night/40">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-canvas border-t-transparent" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center gap-2.5 sm:items-start">
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-ink/15 px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/40 disabled:opacity-50"
          >
            {imageUrl ? "Change photo" : "Upload photo"}
          </button>
          {imageUrl && (
            <button
              type="button"
              disabled={busy}
              onClick={handleRemove}
              className="rounded-lg px-3.5 py-2 text-sm text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
        <p className="text-center text-xs text-muted sm:text-left">
          JPEG, PNG, or WEBP. Max 5MB.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        {error && <InlineBanner kind="error" message={error} />}
        {success && !error && <InlineBanner kind="success" message={success} />}
      </div>
    </div>
  );
}
