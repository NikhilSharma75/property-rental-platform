"use client";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

/** Debounced search box - avoids firing a request per keystroke. */
export function SearchInput({
  placeholder, onSearch, delay = 350,
}: { placeholder: string; onSearch: (q: string) => void; delay?: number }) {
  const [value, setValue] = useState("");
  useEffect(() => {
    const t = setTimeout(() => onSearch(value.trim()), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay]);

  return (
    <label className="glass flex min-w-[240px] items-center gap-2 rounded-xl border border-ink/12 px-3 py-2 focus-within:border-primary">
      <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      <input
        type="search" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder}
        aria-label={placeholder} className="w-full bg-transparent text-sm outline-none placeholder:text-muted/70"
      />
    </label>
  );
}

export function Select({
  value, onChange, options, label,
}: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}
      className="glass rounded-xl border border-ink/12 px-3 py-2 text-sm outline-none focus:border-primary">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
