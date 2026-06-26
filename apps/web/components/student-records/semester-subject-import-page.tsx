'use client';

import { useMemo } from 'react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StudentBulkImportPanel } from '@/components/student-records/student-bulk-import-panel';
import { useRequireAuth } from '@/hooks/use-auth';

const TITLES: Record<1 | 3 | 5, string> = {
  1: 'Semester 1 Subject Import',
  3: 'Semester 3 Subject Import',
  5: 'Semester 5 Subject Import',
};

export function SemesterSubjectImportPage({ semester }: { semester: 1 | 3 | 5 }) {
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
    <DashboardShell role="admin" title={TITLES[semester]}>
      <div className="mx-auto max-w-7xl space-y-4">
        <StudentBulkImportPanel canImport={canImport} focusSemester={semester} />
      </div>
    </DashboardShell>
  );
}
