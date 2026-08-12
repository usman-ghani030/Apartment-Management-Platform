import React from 'react';
import { ResidentShell } from '@/components/dashboard/resident-shell';

export default function ResidentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ResidentShell>{children}</ResidentShell>;
}
