'use client';

import React from 'react';

/**
 * Labelled value cell. Used in list rows and detail panels so every card says
 * what its data actually is ("Floor 3", not a bare "3") instead of relying on
 * the reader to guess from context.
 *
 *   <Field label="Resident">Ali Khan</Field>
 */
export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">{label}</p>
      <p className="mt-0.5 truncate text-body-sm font-medium text-gray-900">{children}</p>
      {hint && <p className="mt-0.5 truncate text-caption-xs text-gray-500">{hint}</p>}
    </div>
  );
}

/** Row of `Field`s that wraps to two columns on narrow screens. */
export function FieldRow({
  columns = 4,
  className = '',
  children,
}: {
  columns?: 2 | 3 | 4;
  className?: string;
  children: React.ReactNode;
}) {
  const cols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
  }[columns];
  return <div className={`grid ${cols} gap-x-6 gap-y-3.5 ${className}`}>{children}</div>;
}
