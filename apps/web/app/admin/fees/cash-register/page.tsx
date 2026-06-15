'use client';

import { FeeCashRegisterPanel } from '@/components/fees-module/fee-cash-register-panel';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Cash Register">
      <FeeCashRegisterPanel />
    </DashboardShell>
  );
}
