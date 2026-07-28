'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gray-50 mb-4">
        <Icon className="w-7 h-7 text-gray-400" />
      </div>
      <h3 className="text-title-sm font-display text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-body-sm text-gray-700 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
