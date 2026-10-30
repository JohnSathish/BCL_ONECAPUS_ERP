import { Suspense } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { DepartmentInventoryWorkspace } from '@/components/library/department-inventory-workspace';

export default function DepartmentInventoryPage() {
  return (
    <DashboardShell role="admin" title="Department-wise book inventory">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the inventory…</p>}>
        <DepartmentInventoryWorkspace />
      </Suspense>
    </DashboardShell>
  );
}
