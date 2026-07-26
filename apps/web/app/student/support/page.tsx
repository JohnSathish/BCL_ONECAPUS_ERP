'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StudentSupportHome } from '@/components/support-centre/student-support-panels';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StudentSupportPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="student" title="Support Centre">
      <StudentSupportHome />
    </DashboardShell>
  );
}
