'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StudentSupportTickets } from '@/components/support-centre/student-support-panels';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StudentSupportTicketsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="student" title="My Tickets">
      <StudentSupportTickets />
    </DashboardShell>
  );
}
