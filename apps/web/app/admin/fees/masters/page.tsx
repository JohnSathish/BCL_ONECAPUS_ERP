'use client';

import { FeeHeadMasterPanel } from '@/components/fees-module/fee-head-master-panel';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AdminFeeMastersPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Fee Head Master">
      <FeeHeadMasterPanel />
    </DashboardShell>
  );
}
