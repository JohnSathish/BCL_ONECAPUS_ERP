'use client';

import { FeeCollectionDesk } from '@/components/fees-module/fee-collection-desk';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Payment Facilitation Desk">
      <FeeCollectionDesk />
    </DashboardShell>
  );
}
