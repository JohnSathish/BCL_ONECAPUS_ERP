'use client';

import { FeeSettingsPanel } from '@/components/fees-module/fee-settings-panel';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Fee Settings">
      <FeeSettingsPanel />
    </DashboardShell>
  );
}
