'use client';

import React from 'react';

/**
 * The one panel shell every dashboard block uses: a hairline top rule, a header
 * with an icon chip, title, optional hint, optional count pill, a body, and an
 * optional pinned footer. Colour is decoration-free, so a page of panels reads
 * as a single system rather than a set of cards that each look different.
 *
 *   <Panel icon={Wrench} title="Timeline" hint="6 updates">
 *     ...rows...
 *   </Panel>
 */
export function Panel({
  icon: Icon,
  title,
  hint,
  meta,
  action,
  children,
  className = '',
  bodyClassName = '',
}: {
  icon?: React.ElementType;
  title: string;
  hint?: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`group/panel relative flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:border-accent-200 hover:shadow-[0_8px_24px_-12px_rgba(37,99,235,0.22)] ${className}`}
    >
      <span className="absolute inset-x-0 top-0 h-0.5 bg-accent-500" aria-hidden="true" />

      <header className="flex items-start gap-3 border-b border-gray-100 px-5 py-4">
        {Icon && (
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-accent-600 text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,1)]">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-body font-semibold text-gray-900">{title}</h2>
          {hint && <p className="mt-0.5 text-caption-xs text-gray-500">{hint}</p>}
        </div>
        {meta && <div className="flex-shrink-0">{meta}</div>}
      </header>

      <div className={`flex-1 ${bodyClassName}`}>{children}</div>

      {action && <footer className="mt-auto border-t border-gray-100 bg-gray-50/60 px-4 py-3">{action}</footer>}
    </section>
  );
}

/** Small counted pill for panel headers and section titles. */
export function CountPill({ children, tone = 'accent' }: { children: React.ReactNode; tone?: 'accent' | 'neutral' }) {
  const styles =
    tone === 'neutral'
      ? 'bg-gray-50 text-gray-500 ring-gray-200/80'
      : 'bg-accent-50 text-accent-700 ring-accent-200/70';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ring-1 ${styles}`}>
      {children}
    </span>
  );
}

/** Eyebrow + rule divider used for sections that sit outside a panel. */
export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3.5 flex items-center gap-3">
      <span className="h-4 w-1 rounded-full bg-accent-400" aria-hidden="true" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">{children}</p>
      <span className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent" aria-hidden="true" />
      {right}
    </div>
  );
}

/** Illustrated empty state inside a panel or card. */
export function PanelEmpty({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 text-center ${compact ? 'py-9' : 'py-12'}`}>
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50">
        <Icon className="h-6 w-6 text-accent-600" />
      </span>
      <h3 className="text-title-sm font-display text-gray-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-xs text-body-sm text-gray-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
