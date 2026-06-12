'use client';

import { FeesWorkspace } from '@/components/fees-module/fees-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StudentFeesPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="student" title="My Fees">
      <FeesWorkspace page="student" portal="student" />
    </DashboardShell>
  );
}
