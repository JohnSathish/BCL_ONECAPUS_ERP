'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StudentIaPortal } from '@/components/examinations/ia/student-ia-portal';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StudentExaminationsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="student" title="Internal Assessment">
      <StudentIaPortal />
    </DashboardShell>
  );
}
