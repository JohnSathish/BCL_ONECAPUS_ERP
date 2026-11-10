'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AppInstallationReport } from '@/components/administration-module/app-installation-report';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AppInstallationReportPage() {
  const session = useRequireAuth();
  if (!session) return null;

  return (
    <DashboardShell
      role="admin"
      title="App Installation Report"
      subtitle="Department-wise Don Bosco College mobile app installation status"
    >
      <AppInstallationReport />
    </DashboardShell>
  );
}
