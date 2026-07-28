'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { MoodleSyncDashboardPanel } from '@/components/lms-module/moodle-sync-dashboard';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AdminMoodleSyncPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Moodle sync">
      <MoodleSyncDashboardPanel />
    </DashboardShell>
  );
}
