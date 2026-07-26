'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StudentSupportFaq } from '@/components/support-centre/student-support-panels';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StudentSupportFaqPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="student" title="FAQs">
      <StudentSupportFaq />
    </DashboardShell>
  );
}
