'use client';

import React from 'react';

type CardVariant = 'default' | 'elevated' | 'interactive' | 'accent';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, variant = 'default', className = '', onClick }: CardProps) {
  const styles = {
    default: 'bg-white border border-gray-200 rounded-xl shadow-sm',
    elevated: 'bg-white border border-gray-200 rounded-xl shadow-md',
    interactive: 'bg-white border border-gray-200 rounded-xl shadow-sm hover:border-accent-300 hover:shadow-md transition-all duration-200 cursor-pointer',
    accent: 'bg-white border-2 border-accent-500 rounded-xl shadow-md',
  };

  return (
    <div
      className={`${styles[variant]} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}
