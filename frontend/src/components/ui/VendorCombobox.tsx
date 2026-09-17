'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mail, Phone, Plus, Search, UserPlus, X } from 'lucide-react';
import { apiGet } from '@/lib/api';
import type { VendorSearchResult } from '@apartment/shared';

/**
 * The one contact channel we can show for a vendor: the phone if it has one,
 * otherwise the email. Never both (the row would be too wide to scan) and never
 * a bare "null" - an email-only vendor is a perfectly valid vendor.
 */
function contactLabel(vendor: { phone: string | null; email: string | null }): string {
  return vendor.phone || vendor.email || 'No contact on file';
}

/**
 * Async vendor autocomplete for the ticket assignment form.
 *
 * Deliberately the same look and keyboard behaviour as `ui/Select` (same input,
 * ring, dropdown shell) - it only differs where it must: the options come from
 * `GET /api/v1/vendors/search` (debounced), and when nothing matches it offers
 * "Add ... as new vendor" instead of a dead end.
 *
 * The parent owns no search state: selecting a vendor hands back the whole
 * `VendorSearchResult` (which carries the id the ticket is assigned by), and
 * choosing "add new" hands back the typed text so the parent can create the
 * vendor through the normal create endpoint and then select it.
 */
export function VendorCombobox({
  selected,
  onSelect,
  onCreateRequest,
  disabled = false,
}: {
  selected: VendorSearchResult | null;
  onSelect: (vendor: VendorSearchResult | null) => void;
  onCreateRequest: (typed: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<VendorSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();

  // ── Debounced search-as-you-type (~300ms) ────────────────────────────────
  useEffect(() => {
    if (!open || !trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await apiGet<VendorSearchResult[]>(
          `/api/v1/vendors/search?q=${encodeURIComponent(trimmed)}`
        );
        if (!cancelled) setResults(data || []);
      } catch {
        // Best-effort: an unreachable search shouldn't block typing a new
        // vendor in - the "add new" row below is still offered.
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, open]);

  // ── Close on click outside ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (activeIndex > results.length - 1) setActiveIndex(0);
  }, [results.length, activeIndex]);

  const pick = useCallback(
    (vendor: VendorSearchResult) => {
      onSelect(vendor);
      setQuery('');
      setResults([]);
      setOpen(false);
    },
    [onSelect]
  );

  const clear = useCallback(() => {
    onSelect(null);
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  }, [onSelect]);

  const requestCreate = useCallback(() => {
    if (!trimmed) return;
    onCreateRequest(trimmed);
    setQuery('');
    setResults([]);
    setOpen(false);
  }, [trimmed, onCreateRequest]);

  const showCreateRow = !searching && !!trimmed && results.length === 0;
  const rowCount = results.length + (showCreateRow ? 1 : 0);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else if (rowCount) setActiveIndex((i) => (i + 1) % rowCount);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowCount) setActiveIndex((i) => (i - 1 + rowCount) % rowCount);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!open) return;
      const vendor = results[activeIndex];
      if (vendor) pick(vendor);
      else if (showCreateRow) requestCreate();
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
  };

  // Same middle-dot separator the ticket meta rows use. A vendor only needs one
  // contact channel, so the secondary half is whichever one exists - showing
  // "Name · null" for an email-only vendor would look broken.
  const displayValue = selected && !query ? [selected.name, contactLabel(selected)].join(' · ') : query;

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`
          flex w-full items-center gap-2 rounded-xl border bg-gray-50 pl-10 pr-16 py-2.5
          transition-all
          ${open ? 'border-accent-400 bg-white ring-4 ring-accent-500/10' : 'border-gray-200/80'}
          ${disabled ? 'cursor-not-allowed opacity-50' : ''}
        `}
      >
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="vendor-combobox-list"
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          value={displayValue}
          placeholder="Search by name or phone..."
          onFocus={() => !disabled && setOpen(true)}
          onChange={(e) => {
            const next = e.target.value;
            // Typing replaces any current selection - the ticket is only ever
            // assigned to something the admin explicitly picked.
            if (selected) onSelect(null);
            setQuery(next);
            setActiveIndex(0);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent text-body-sm text-gray-900 placeholder-gray-400 focus:outline-none disabled:cursor-not-allowed"
        />
        {searching && (
          <Loader2 className="absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
        )}
        {selected && !searching && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Clear selected vendor"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {open && !!trimmed && (
        <div
          id="vendor-combobox-list"
          role="listbox"
          className="absolute z-50 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-gray-200/80 bg-white py-1.5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.25)]"
        >
          {results.map((v, i) => (
            <button
              key={v.id}
              type="button"
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => pick(v)}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors duration-100 ${
                i === activeIndex ? 'bg-accent-50' : 'hover:bg-gray-50'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5 flex-shrink-0 text-accent-500" />
              <span className="min-w-0 flex-1 truncate text-body-sm text-gray-900">{v.name}</span>
              <span className="flex flex-shrink-0 items-center gap-1 text-caption-xs text-gray-400">
                {v.phone ? <Phone className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                {contactLabel(v)}
              </span>
            </button>
          ))}

          {showCreateRow && (
            <button
              type="button"
              role="option"
              aria-selected={activeIndex === results.length}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActiveIndex(results.length)}
              onClick={requestCreate}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors duration-100 ${
                activeIndex === results.length ? 'bg-accent-50' : 'hover:bg-gray-50'
              }`}
            >
              <Plus className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
              <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-gray-900">
                Add &ldquo;{trimmed}&rdquo; as new vendor
              </span>
            </button>
          )}

          {!searching && !trimmed && (
            <p className="px-3.5 py-3 text-body-sm text-gray-400">Type a name or phone number.</p>
          )}
        </div>
      )}
    </div>
  );
}
