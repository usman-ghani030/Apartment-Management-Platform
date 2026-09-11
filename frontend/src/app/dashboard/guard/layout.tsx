import React from 'react';
import { GuardShell } from '@/components/dashboard/guard-shell';

export default function GuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GuardShell>{children}</GuardShell>;
}
