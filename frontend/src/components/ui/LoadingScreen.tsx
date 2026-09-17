'use client';

import React from 'react';

/**
 * Route-level loading UI. Deliberately quiet: a slowly breathing brand mark,
 * a slim indeterminate accent bar and one line of context. No bouncing dots,
 * no full-screen takeover animation.
 *
 *   <LoadingScreen label="Loading your dashboard" />
 */
export function LoadingScreen({
  label = 'Loading',
  hint,
  className = '',
}: {
  label?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 ${className}`}
    >
      <div className="relative flex h-16 w-16 items-center justify-center">
        {/* Soft halo that breathes with the mark */}
        <span className="absolute inset-0 rounded-3xl bg-accent-500/10 animate-breathe" aria-hidden="true" />
        <span className="absolute inset-1.5 rounded-2xl bg-accent-500/10" aria-hidden="true" />
        <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 shadow-[0_10px_24px_-14px_rgba(37,99,235,1)] animate-breathe">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo3.png" alt="" className="h-6 w-auto object-contain brightness-0 invert" />
        </span>
      </div>

      {/* Indeterminate bar */}
      <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-gray-200/70" aria-hidden="true">
        <div className="h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-400 animate-loading-bar" />
      </div>

      <p className="mt-4 text-body-sm font-medium text-gray-500">{label}</p>
      {hint && <p className="mt-1 max-w-xs text-center text-caption-xs text-gray-400">{hint}</p>}
    </div>
  );
}

/**
 * Shimmering placeholder block. Used to sketch a page's real shape while it
 * loads, which reads far calmer than a spinner on a full page.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-gray-200/60 ${className}`} aria-hidden="true">
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

/**
 * Content-area skeleton: a heading, a row of tiles and two panels. Sits inside
 * the dashboard shell, so the sidebar and top bar stay put while a page loads.
 */
export function PageSkeleton({ width = 'max-w-7xl' }: { width?: 'max-w-5xl' | 'max-w-6xl' | 'max-w-7xl' }) {
  return (
    <div className={`mx-auto ${width} px-6 py-8`} role="status" aria-live="polite">
      <span className="sr-only">Loading page</span>
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}
