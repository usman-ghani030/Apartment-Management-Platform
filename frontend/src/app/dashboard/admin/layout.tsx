import React from 'react';
import { AdminShell } from '@/components/dashboard/admin-shell';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
