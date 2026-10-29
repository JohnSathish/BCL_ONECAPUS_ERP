import { Suspense } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CollectionReportsWorkspace } from '@/components/library/collection-reports-workspace';

export default function CollectionReportsPage() {
  return (
    <DashboardShell role="admin" title="Library collection reports">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading reports…</p>}>
        <CollectionReportsWorkspace />
      </Suspense>
    </DashboardShell>
  );
}
