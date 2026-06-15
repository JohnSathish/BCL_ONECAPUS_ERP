'use client';

import { StudentFeePortal } from '@/components/fees-module/student-fee-portal';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StudentFeesPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="student" title="My Fees">
      <StudentFeePortal />
    </DashboardShell>
  );
}
