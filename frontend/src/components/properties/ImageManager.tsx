"use client";

import { errorMessage } from "@/lib/errors";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { InlineBanner } from "@/components/profile/InlineBanner";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES = 8;

export function ImageManager({
  propertyId,
  images,
  onChange,
}: {
  propertyId: string;
  images: string[];
  onChange: (images: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingUrl, setRemovingUrl] = useState<string | null>(null);

  function validateFiles(files: File[]): string | null {
    if (images.length + files.length > MAX_IMAGES) return `A property can have at most ${MAX_IMAGES} photos.`;
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) return "Please upload JPEG, PNG, or WEBP images only.";
      if (file.size > MAX_BYTES) return "Each photo must be 8MB or smaller.";
    }
    return null;
  }

  async function handleFiles(fileList: FileList) {
    setError(null);
    const files = Array.from(fileList);
    const problem = validateFiles(files);
    if (problem) { setError(problem); return; }

    setBusy(true);
    try {
      const { property } = await api.uploadPropertyImages(propertyId, files);
      onChange(property.images);
    } catch (err) {
      setError(errorMessage(err, "Failed to upload photos."));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(url: string) {
    setError(null);
    setRemovingUrl(url);
    try {
      const { property } = await api.removePropertyImage(propertyId, url);
      onChange(property.images);
    } catch (err) {
      setError(errorMessage(err, "Failed to remove photo."));
    } finally {
      setRemovingUrl(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((url) => (
          <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border border-ink/8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Property photo" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => handleRemove(url)}
              disabled={removingUrl === url}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-night/70 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-60"
              aria-label="Remove photo"
            >
              {removingUrl === url ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        ))}

        {images.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink/20 text-muted transition-colors hover:border-gold hover:text-ink disabled:opacity-50"
          >
            {busy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <span className="text-xs font-medium">Add photo</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <p className="text-xs text-muted">{images.length}/{MAX_IMAGES} photos - JPEG, PNG, or WEBP, up to 8MB each.</p>
      {error && <InlineBanner kind="error" message={error} />}
    </div>
  );
}