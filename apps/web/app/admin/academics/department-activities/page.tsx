'use client';

import { Suspense } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { DepartmentActivitiesWorkspace } from '@/components/department-activities/department-activities-workspace';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AdminDepartmentActivitiesPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Department Activities">
      <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
        <DepartmentActivitiesWorkspace />
      </Suspense>
    </DashboardShell>
  );
}
