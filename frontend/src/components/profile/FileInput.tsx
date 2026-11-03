"use client";

import { useRef } from "react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;

export function validateDocument(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Upload a JPEG, PNG, WEBP, or PDF file.";
  }
  if (file.size > MAX_BYTES) {
    return "File must be 10MB or smaller.";
  }
  return null;
}

export function FileInput({
  id,
  label,
  required,
  file,
  existingUrl,
  onChange,
  error,
}: {
  id: string;
  label: string;
  required?: boolean;
  file: File | null;
  existingUrl?: string | null;
  onChange: (file: File | null, error: string | null) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      <div
        className={`flex flex-wrap items-center gap-3 border px-3.5 py-2.5 ${
          error ? "border-danger" : "border-ink/15"
        }`}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-ink/40"
        >
          Choose file
        </button>
        <span className="min-w-0 flex-1 truncate text-sm text-muted">
          {file?.name ?? (existingUrl ? "A document is already on file." : "No file selected.")}
        </span>
        {existingUrl && !file && (
          <a
            href={existingUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-sm font-medium text-gold hover:underline"
          >
            View
          </a>
        )}
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const picked = e.target.files?.[0] ?? null;
            if (!picked) {
              onChange(null, null);
              return;
            }
            const problem = validateDocument(picked);
            onChange(problem ? null : picked, problem);
          }}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
      <p className="mt-1.5 text-xs text-muted">JPEG, PNG, WEBP, or PDF. Max 10MB.</p>
    </div>
  );
}
