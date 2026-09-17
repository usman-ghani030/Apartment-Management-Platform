'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

/**
 * Searchable dropdown that replaces the native <select>, so both the trigger
 * and the options list are fully styled and the user can TYPE to filter.
 *
 * Accepts the same <option> children pattern as a native select, so every
 * existing call site works without changes:
 *
 *   <Select value={val} onChange={(e) => setVal(e.target.value)}>
 *     <option value="">Pick one...</option>
 *     <option value="a">Alpha</option>
 *   </Select>
 *
 * Behaviour:
 * - Focus or click opens the list and selects the current text, so typing
 *   immediately replaces it and filters the options.
 * - Arrow keys move, Enter picks, Escape reverts, Tab closes.
 * - Clearing the text (or the X button) resets the value to the empty option.
 */

type Option = { value: string; label: string; disabled?: boolean };

/** Bolds the part of a label that matched what the user typed. */
function Highlight({ label, query }: { label: string; query: string }) {
  if (!query) return <>{label}</>;
  const at = label.toLowerCase().indexOf(query);
  if (at < 0) return <>{label}</>;
  return (
    <>
      {label.slice(0, at)}
      <span className="bg-accent-100 font-semibold text-accent-800">
        {label.slice(at, at + query.length)}
      </span>
      {label.slice(at + query.length)}
    </>
  );
}

export function Select({
  value = '',
  onChange,
  required,
  disabled,
  className = '',
  children,
}: {
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // ── Parse <option> children into { value, label, disabled }[] ───────────
  const options = useMemo<Option[]>(() => {
    const opts: Option[] = [];
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type !== 'option') return;
      const props = child.props as { value?: string; children?: React.ReactNode; disabled?: boolean };
      const label = typeof props.children === 'string' ? props.children : String(props.children ?? '');
      opts.push({ value: String(props.value ?? ''), label: label.trim(), disabled: props.disabled });
    });
    return opts;
  }, [children]);

  const selected = options.find((o) => o.value === value);
  const placeholder = options.find((o) => o.value === '')?.label ?? 'Select...';
  const label = selected ? selected.label : placeholder;

  const query = typing ? draft.trim().toLowerCase() : '';
  const filtered = useMemo(
    () => (query ? options.filter((o) => o.label.toLowerCase().includes(query)) : options),
    [options, query],
  );

  // ── Close on click outside ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setTyping(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Keep the active row valid as the filtered list changes
  useEffect(() => {
    if (activeIndex > filtered.length - 1) setActiveIndex(Math.max(0, filtered.length - 1));
  }, [filtered.length, activeIndex]);

  // Scroll the active row into view
  useEffect(() => {
    if (!open) return;
    const item = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`) as HTMLElement | null;
    item?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const openList = useCallback(
    (selectText: boolean) => {
      if (disabled) return;
      setOpen(true);
      const idx = options.findIndex((o) => o.value === value);
      setActiveIndex(idx >= 0 ? idx : 0);
      if (selectText) {
        // Let the browser paint, then select the text so typing replaces it
        requestAnimationFrame(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        });
      }
    },
    [disabled, options, value],
  );

  const commit = useCallback(
    (opt: Option) => {
      if (opt.disabled) return;
      onChange?.({ target: { value: opt.value } });
      setOpen(false);
      setTyping(false);
      setDraft('');
      inputRef.current?.focus();
    },
    [onChange],
  );

  const clear = useCallback(() => {
    onChange?.({ target: { value: '' } });
    setTyping(false);
    setDraft('');
    inputRef.current?.focus();
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;

      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
          e.preventDefault();
          openList(false);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          if (filtered.length === 0) return;
          let next = activeIndex + 1;
          while (next < filtered.length && filtered[next].disabled) next += 1;
          setActiveIndex(next < filtered.length ? next : activeIndex);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (filtered.length === 0) return;
          let prev = activeIndex - 1;
          while (prev >= 0 && filtered[prev].disabled) prev -= 1;
          if (prev >= 0) setActiveIndex(prev);
          break;
        }
        case 'Enter': {
          // Always swallow Enter while open so it never submits the form
          e.preventDefault();
          const opt = filtered[activeIndex];
          if (opt) commit(opt);
          break;
        }
        case 'Escape': {
          e.preventDefault();
          setOpen(false);
          setTyping(false);
          setDraft('');
          break;
        }
        case 'Tab': {
          setOpen(false);
          setTyping(false);
          setDraft('');
          break;
        }
        default:
          break;
      }
    },
    [disabled, open, filtered, activeIndex, commit, openList],
  );

  const showClear = !disabled && value !== '' && !!selected;

  return (
    <div ref={containerRef} className={`relative group ${className}`}>
      <div
        className={`
          flex w-full items-center gap-2 rounded-xl border bg-white
          pl-4 pr-16 py-2.5
          shadow-[0_1px_2px_rgba(15,23,42,0.04)]
          transition-all duration-200
          hover:border-gray-300 hover:shadow-sm
          ${open ? 'border-accent-400 ring-4 ring-accent-500/10 shadow-md' : 'border-gray-200/80'}
          ${disabled ? 'cursor-not-allowed opacity-50' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-required={required}
          aria-activedescendant={open && filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          autoComplete="off"
          disabled={disabled}
          value={typing ? draft : label}
          placeholder={placeholder}
          onChange={(e) => {
            let next = e.target.value;
            // Clicking placed the caret inside the selected label, then typing
            // appends to it - drop the label so the draft is only what was typed.
            if (!typing && selected && next.length > label.length && next.startsWith(label)) {
              next = next.slice(label.length);
            }
            setDraft(next);
            setTyping(true);
            setActiveIndex(0);
            if (!open) setOpen(true);
          }}
          onFocus={() => openList(true)}
          onMouseDown={(e) => {
            // Closed input: open the list instead of just placing the caret
            if (!open) {
              e.preventDefault();
              openList(true);
            }
          }}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 truncate bg-transparent text-left text-body-sm text-gray-900 placeholder-gray-400 focus:outline-none disabled:cursor-not-allowed"
        />

        {/* Clear */}
        {showClear && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Clear selection"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            className="absolute right-9 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}

        {/* Chevron (toggles the list) */}
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? 'Close options' : 'Open options'}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => (open ? (setOpen(false), setTyping(false), setDraft('')) : openList(false))}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-gray-400 transition-colors hover:text-gray-600 disabled:cursor-not-allowed"
        >
          <svg
            className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180 text-accent-500' : 'group-hover:text-gray-600'}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.04.02L10 11.168l3.73-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.04z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Options panel */}
      {open && (
        <div
          id={listId}
          role="listbox"
          ref={listRef}
          className="absolute z-50 mt-2 max-h-64 w-full min-w-[200px] origin-top overflow-auto rounded-xl border border-gray-200/80 bg-white py-1.5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.25)]"
        >
          {filtered.length === 0 ? (
            <div className="px-3.5 py-3">
              <p className="text-body-sm text-gray-500">No matches for &ldquo;{draft.trim()}&rdquo;</p>
              <p className="mt-0.5 text-caption-xs text-gray-400">Try a different word.</p>
            </div>
          ) : (
            filtered.map((opt, i) => {
              const isSelected = opt.value === value;
              const isActive = i === activeIndex;
              return (
                <button
                  key={opt.value || `_${i}`}
                  id={`${listId}-${i}`}
                  data-idx={i}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  // Keep focus in the input so the click lands before a blur closes the list
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => commit(opt)}
                  className={`
                    flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-body-sm transition-colors duration-100
                    ${opt.disabled
                      ? 'cursor-not-allowed text-gray-300'
                      : isActive
                        ? 'bg-accent-50 text-accent-700'
                        : isSelected
                          ? 'font-medium text-accent-700'
                          : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <span className={`w-4 flex-shrink-0 text-center ${isSelected ? 'text-accent-500' : 'text-transparent'}`}>
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <span className="flex-1 truncate">
                    <Highlight label={opt.label} query={query} />
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
