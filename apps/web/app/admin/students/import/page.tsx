'use client';

import { useMemo } from 'react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StudentBulkImportPanel } from '@/components/student-records/student-bulk-import-panel';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StudentBulkImportPage() {
  const session = useRequireAuth();

  const canImport = useMemo(
    () =>
      session?.user.roles.some((r) =>
        ['college-admin', 'super-admin', 'university-admin'].includes(r),
      ) ?? false,
    [session],
  );

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Student Import Studio">
      <div className="mx-auto max-w-7xl space-y-4">
        <StudentBulkImportPanel canImport={canImport} />
      </div>
    </DashboardShell>
  );
}
