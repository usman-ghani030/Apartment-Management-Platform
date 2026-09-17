'use client';

import React from 'react';

type Tone = 'accent' | 'danger' | 'warning' | 'success' | 'neutral';

const TONES: Record<Tone, { chip: string; value: string }> = {
  accent: { chip: 'bg-accent-50 text-accent-600', value: 'text-gray-900' },
  danger: { chip: 'bg-red-50 text-red-600', value: 'text-red-600' },
  warning: { chip: 'bg-amber-50 text-amber-600', value: 'text-amber-600' },
  success: { chip: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-600' },
  neutral: { chip: 'bg-gray-100 text-gray-500', value: 'text-gray-900' },
};

/**
 * Stat tile used at the top of every dashboard page: a hairline accent rule,
 * an uppercase micro-label, the figure, a hint that says what the figure means,
 * and an icon chip. Tone is reserved for things that are actually wrong
 * (overdue money, open emergencies) so a page of tiles still reads as one blue.
 *
 *   <StatTile icon={Ticket} label="Open" value={3} hint="Being worked on" />
 */
export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'accent',
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: Tone;
}) {
  const t = TONES[tone];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-[0_10px_26px_-14px_rgba(37,99,235,0.28)]">
      <span className="absolute inset-x-0 top-0 h-1 bg-accent-500" aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">{label}</p>
          <p className={`mt-2.5 truncate text-display font-display tabular-nums leading-none ${t.value}`}>{value}</p>
          {hint && <p className="mt-1.5 truncate text-caption-xs text-gray-500">{hint}</p>}
        </div>
        <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${t.chip}`}>
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
    </div>
  );
}

/** Responsive row of tiles: two across on phones, up to four on desktop. */
export function StatTileGrid({
  columns = 4,
  className = '',
  style,
  children,
}: {
  columns?: 3 | 4;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const cols = columns === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4';
  return (
    <div className={`grid grid-cols-2 gap-4 ${cols} ${className}`} style={style}>
      {children}
    </div>
  );
}
