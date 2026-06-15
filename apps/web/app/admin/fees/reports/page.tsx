'use client';

import { FinancialReportsCenter } from '@/components/fees-module/financial-reports-center';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Finance / Financial Reports Center">
      <FinancialReportsCenter />
    </DashboardShell>
  );
}
