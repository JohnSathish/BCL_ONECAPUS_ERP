'use client';

import { OperationsCommandCenter } from '@/components/dashboard/operations-command-center';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AdminDashboardPage() {
  const session = useRequireAuth();
  if (!session) return null;

  const userName = session.user.email.split('@')[0] ?? 'Admin';

  return (
    <DashboardShell role="admin">
      <OperationsCommandCenter userName={userName} />
    </DashboardShell>
  );
}
