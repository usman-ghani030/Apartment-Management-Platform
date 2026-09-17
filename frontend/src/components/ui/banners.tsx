'use client';

import React, { useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Copy } from 'lucide-react';

/** Eye-catching success feedback - dark emerald text, solid icon badge. */
export function SuccessBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-3 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-300 border-l-4 border-l-emerald-500 rounded-xl px-4 py-3.5 mb-6 shadow-sm"
      role="status"
    >
      <span className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-sm">
        <CheckCircle2 className="w-5 h-5 text-white" />
      </span>
      <div className="text-sm text-emerald-900 font-medium min-w-0">{children}</div>
    </div>
  );
}

/** Prominent one-click copy block for temporary passwords / secrets. */
export function PasswordReveal({ password }: { password: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context) - text is select-all anyway.
    }
  };

  return (
    <div className="mt-3 bg-white border border-emerald-200 rounded-lg p-3 flex items-center gap-3 flex-wrap shadow-sm">
      <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
        Temporary password
      </span>
      <code className="text-base font-mono font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg tracking-wider select-all">
        {password}
      </code>
      <button
        type="button"
        onClick={copy}
        className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/** High-contrast error feedback - dark red text, solid icon badge. */
export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-3 bg-gradient-to-r from-red-50 to-rose-50 border border-red-300 border-l-4 border-l-red-500 rounded-xl px-4 py-3.5 mb-6 shadow-sm"
      role="alert"
    >
      <span className="w-9 h-9 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 shadow-sm">
        <AlertCircle className="w-5 h-5 text-white" />
      </span>
      <div className="text-sm text-red-900 font-medium min-w-0">{children}</div>
    </div>
  );
}
