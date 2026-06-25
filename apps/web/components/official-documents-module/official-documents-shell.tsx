'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export function OfficialDocumentsShell({
  title = 'Official Documents',
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const session = useRequireAuth();
  if (!session) return null;

  return (
    <DashboardShell role="admin" title={title} pageHeader={false}>
      {children}
    </DashboardShell>
  );
}
