'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AppUpdateManagement } from '@/components/administration-module/app-update-management';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AppUpdatesAdminPage() {
  const session = useRequireAuth();
  if (!session) return null;

  return (
    <DashboardShell role="admin" title="App Update Management">
      <AppUpdateManagement />
    </DashboardShell>
  );
}
