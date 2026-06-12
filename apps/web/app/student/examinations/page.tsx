'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StudentExamPortal } from '@/components/student-exams/student-exam-portal';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StudentExaminationsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="student" title="My Examinations">
      <StudentExamPortal />
    </DashboardShell>
  );
}
