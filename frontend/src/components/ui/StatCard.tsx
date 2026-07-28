'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: 'accent' | 'info' | 'warning' | 'danger' | 'success';
  trend?: { direction: 'up' | 'down'; label: string };
  onClick?: () => void;
}

const accentMap = {
  accent: { bg: 'bg-accent-50', text: 'text-accent-600', icon: 'text-accent-600' },
  info: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'text-blue-600' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-600', icon: 'text-amber-600' },
  danger: { bg: 'bg-red-50', text: 'text-red-600', icon: 'text-red-600' },
  success: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'text-emerald-600' },
};

export function StatCard({ label, value, icon: Icon, accent = 'accent', trend, onClick }: StatCardProps) {
  const colors = accentMap[accent] || accentMap.accent;

  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl shadow-sm p-4.5 ${onClick ? 'hover:border-accent-300 hover:shadow-md transition-all duration-200 cursor-pointer' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-caption-xs font-medium text-gray-700">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors.bg}`}>
          <Icon className={`w-4.5 h-4.5 ${colors.icon}`} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-display-sm font-bold tracking-tight text-gray-900">{value}</span>
        {trend && (
          <span className={`text-caption-xs font-medium mb-1 ${trend.direction === 'up' ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend.direction === 'up' ? '↑' : '↓'} {trend.label}
          </span>
        )}
      </div>
    </div>
  );
}
