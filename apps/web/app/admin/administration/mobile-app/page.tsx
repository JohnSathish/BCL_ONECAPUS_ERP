'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { MobileAppControlPanel } from '@/components/administration-module/mobile-app-control-panel';
import { useRequireAuth } from '@/hooks/use-auth';

export default function MobileAppAdminPage() {
  const session = useRequireAuth();
  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Mobile App Control">
      <MobileAppControlPanel />
    </DashboardShell>
  );
}
