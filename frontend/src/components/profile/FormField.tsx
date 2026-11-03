"use client";

import { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const BASE_INPUT =
  "w-full bg-transparent text-[15px] outline-none placeholder:text-muted/60 disabled:opacity-50";
const BASE_WRAPPER =
  "flex items-center gap-2.5 border px-3.5 py-2.5 transition-colors focus-within:border-gold";

function wrapperClass(hasError?: boolean) {
  return `${BASE_WRAPPER} ${hasError ? "border-danger" : "border-ink/15"}`;
}

interface FieldShellProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function FieldShell({ label, htmlFor, required, error, hint, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

interface TextInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string | number;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
  maxLength?: number;
  autoComplete?: string;
}

export function TextInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  step,
  placeholder,
  required,
  disabled,
  error,
  hint,
  maxLength,
  autoComplete,
}: TextInputProps) {
  return (
    <FieldShell label={label} htmlFor={id} required={required} error={error} hint={hint}>
      <div className={wrapperClass(!!error)}>
        <input
          id={id}
          type={type}
          step={step}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className={BASE_INPUT}
        />
      </div>
    </FieldShell>
  );
}

interface TextAreaProps
  extends Pick<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  maxLength?: number;
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
  error,
  maxLength,
  rows = 4,
}: TextAreaProps) {
  return (
    <FieldShell label={label} htmlFor={id} error={error}>
      <div className={`${wrapperClass(!!error)} items-start`}>
        <textarea
          id={id}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          className={`${BASE_INPUT} resize-none`}
        />
      </div>
      {maxLength && (
        <p className="mt-1 text-right text-xs text-muted">
          {value.length}/{maxLength}
        </p>
      )}
    </FieldShell>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps
  extends Pick<SelectHTMLAttributes<HTMLSelectElement>, "disabled"> {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  hint?: string;
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  disabled,
  error,
  hint,
}: SelectFieldProps) {
  return (
    <FieldShell label={label} htmlFor={id} required={required} error={error} hint={hint}>
      <div className={wrapperClass(!!error)}>
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`${BASE_INPUT} appearance-none`}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </FieldShell>
  );
}
