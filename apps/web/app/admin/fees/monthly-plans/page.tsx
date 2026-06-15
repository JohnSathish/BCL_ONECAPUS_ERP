'use client';

import { MonthlyFeePlansPanel } from '@/components/fees-module/monthly-fee-plans-panel';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Monthly Fee Plans">
      <MonthlyFeePlansPanel />
    </DashboardShell>
  );
}
