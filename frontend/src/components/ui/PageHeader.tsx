'use client';

import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 ${className}`}>
      <div>
        <h1 className="text-display-sm font-display text-gray-900">{title}</h1>
        {description && (
          <p className="text-body-sm text-gray-700 mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3 flex-shrink-0">{actions}</div>}
    </div>
  );
}
