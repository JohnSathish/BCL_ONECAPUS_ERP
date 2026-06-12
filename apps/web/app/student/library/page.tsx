'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StudentLibraryPanel } from '@/components/library/student-library-panel';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StudentLibraryPage() {
  useRequireAuth();
  return (
    <DashboardShell role="student" title="Library">
      <StudentLibraryPanel />
    </DashboardShell>
  );
}
