'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Shared dialog shell so every create/edit/import modal in the dashboard reads
 * the same: a hairline accent rule across the top, an icon chip + title header,
 * a scrolling body, and an optional footer for the decision buttons.
 *
 *   <Modal open={open} onClose={close} title="Add Unit" icon={Home} subtitle="...">
 *     <form onSubmit={save}>...</form>
 *   </Modal>
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  size = 'md',
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  size?: 'sm' | 'md' | 'lg';
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Escape closes, and the page behind stops scrolling while the dialog is up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-2xl' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`relative flex max-h-[88vh] w-full ${widths[size]} flex-col overflow-hidden rounded-3xl bg-white shadow-[0_28px_70px_-24px_rgba(4,20,45,0.55)] ring-1 ring-gray-900/5`}
      >
        {/* Signature top rule */}
        <span
          className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-accent-600 via-accent-400 to-transparent"
          aria-hidden="true"
        />

        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-7 pb-5">
          {Icon && (
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 ring-1 ring-accent-300/60 shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)]">
              <Icon className="h-5 w-5 text-white" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-title font-display text-gray-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-body-sm text-gray-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 pb-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex gap-3 border-t border-gray-100 bg-gray-50/70 px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}

/** Shared field styling so form controls inside modals stay identical. */
export const fieldLabel = 'block text-body-sm font-medium text-gray-700 mb-1.5';
export const fieldInput =
  'w-full bg-gray-50 border border-gray-200/80 rounded-xl px-4 py-2.5 text-body-sm text-gray-900 placeholder-gray-400 transition-all focus:outline-none focus:bg-white focus:border-accent-400 focus:ring-4 focus:ring-accent-500/10';
