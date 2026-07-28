'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { MoodleReportsPanel } from '@/components/lms-module/moodle-reports-panel';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AdminMoodleReportsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Moodle reports">
      <MoodleReportsPanel />
    </DashboardShell>
  );
}
