'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';
import { AdminDashboard } from '@/modules/dashboard/admin-dashboard';

export default function AdminDashboardPage() {
  const session = useRequireAuth();
  if (!session) return null;

  const userName = session.user.email.split('@')[0] ?? 'Admin';

  return (
    <DashboardShell role="admin" title="Analytics">
      <AdminDashboard userName={userName} />
    </DashboardShell>
  );
}
