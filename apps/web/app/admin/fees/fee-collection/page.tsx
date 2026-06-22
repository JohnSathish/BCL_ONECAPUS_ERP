'use client';

import { FeeCollectionDesk } from '@/components/fees-module/fee-collection-desk';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function FeeCollectionCenterPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Fee Collection Center" pageHeader={false}>
      <div className="mb-4">
        <h1 className="text-xl font-bold tracking-tight">Fee Collection Center</h1>
        <p className="text-sm text-muted-foreground">
          Daily cashier desk — search, collect, print receipts. For fee setup and policies, use
          Finance Setup Center.
        </p>
      </div>
      <FeeCollectionDesk variant="collection" />
    </DashboardShell>
  );
}
