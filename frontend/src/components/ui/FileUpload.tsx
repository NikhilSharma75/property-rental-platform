"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, FileText } from "lucide-react";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;

export interface FileUploadProps {
  label: string;
  hint?: string;
  value: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

export function FileUpload({ label, hint, value, onChange, disabled }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const accept = useCallback(
    (file: File) => {
      setError(null);
      if (!ACCEPTED.includes(file.type)) {
        setError("Must be a JPEG, PNG, WEBP, or PDF.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("File exceeds the 10 MB limit.");
        return;
      }
      onChange(file);
    },
    [onChange]
  );

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink">{label}</label>
      {hint && <p className="mb-2 text-xs text-slate-500">{hint}</p>}

      {value ? (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 glass px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate text-sm text-ink">{value.name}</span>
            <span className="shrink-0 text-xs text-slate-500">
              ({(value.size / 1024).toFixed(0)} KB)
            </span>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) accept(f);
          }}
          className={`flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-4 text-sm transition ${
            dragOver
              ? "border-primary bg-primary/5 text-primary"
              : "border-slate-300 glass text-slate-500 hover:border-primary/60 hover:text-primary"
          } disabled:opacity-50`}
        >
          <Upload className="h-4 w-4" />
          Click or drop file here
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={ACCEPTED.join(",")}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) accept(f);
          e.target.value = "";
        }}
      />

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
