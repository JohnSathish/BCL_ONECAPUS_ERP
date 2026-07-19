'use client';

import { FeeCollectionCentersAdminPanel } from '@/components/fees-module/fee-collection-centers-admin-panel';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function CollectionCentersAdminPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Finance / Authorized Collection Centers">
      <FeeCollectionCentersAdminPanel />
    </DashboardShell>
  );
}
