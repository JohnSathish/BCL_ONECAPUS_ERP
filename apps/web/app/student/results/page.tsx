'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StudentResultsPortal } from '@/components/student-exams/student-results-portal';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StudentResultsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="student" title="Results">
      <StudentResultsPortal />
    </DashboardShell>
  );
}
