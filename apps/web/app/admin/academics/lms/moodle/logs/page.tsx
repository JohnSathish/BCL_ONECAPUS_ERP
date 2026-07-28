'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { MoodleApiLogsPanel } from '@/components/lms-module/moodle-api-logs-panel';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AdminMoodleLogsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Moodle API logs">
      <MoodleApiLogsPanel />
    </DashboardShell>
  );
}
