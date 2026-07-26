'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StudentSupportContact } from '@/components/support-centre/student-support-panels';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StudentSupportContactPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="student" title="Contact College">
      <StudentSupportContact />
    </DashboardShell>
  );
}
