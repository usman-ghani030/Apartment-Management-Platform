'use client';

import React from 'react';
import { Search, X } from 'lucide-react';

/**
 * Page-level search: the input, a clear (X) button, an optional filter pill row,
 * and a line telling you exactly what you are looking at. Always rendered, so a
 * query with no matches can never remove the control you are typing into.
 *
 *   <SearchField value={q} onChange={setQ} placeholder="Search tickets..."
 *     filters={<FilterPills ... />} hint="12 tickets" />
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  hint,
  filters,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint?: React.ReactNode;
  filters?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full rounded-xl border border-gray-200/80 bg-gray-50 py-2.5 pl-10 pr-10 text-body-sm text-gray-900 placeholder-gray-400 transition-all focus:border-accent-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-accent-500/10"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {filters}

      {hint && <p className="mt-3 text-caption-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export interface FilterOption {
  key: string;
  label: string;
  count?: number;
}

/**
 * Counted filter pills. The active pill is solid accent, everything else is a
 * quiet grey chip, and the counts are always visible so the row doubles as a
 * status breakdown.
 */
export function FilterPills({
  options,
  value,
  onChange,
  onClear,
  className = '',
}: {
  options: FilterOption[];
  value: string;
  onChange: (key: string) => void;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <div className={`mt-3.5 flex flex-wrap items-center gap-2 ${className}`}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption-xs font-semibold transition-all ${
              active
                ? 'bg-accent-600 text-white shadow-[0_6px_16px_-8px_rgba(37,99,235,1)]'
                : 'bg-gray-50 text-gray-600 ring-1 ring-gray-200/80 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={`tabular-nums ${active ? 'text-white/80' : 'text-gray-400'}`}>{o.count}</span>
            )}
          </button>
        );
      })}
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption-xs font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      )}
    </div>
  );
}
