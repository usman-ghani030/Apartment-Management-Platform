'use client';

import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  success: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  danger: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  info: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  neutral: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
};

export function StatusBadge({ variant, children, className = '', dot = true }: StatusBadgeProps) {
  const s = variantStyles[variant];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-caption-xs font-medium ${s.bg} ${s.text} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />}
      {children}
    </span>
  );
}
