'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { MoodleSettingsPanel } from '@/components/lms-module/moodle-settings-panel';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AdminMoodleSettingsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Moodle integration">
      <MoodleSettingsPanel />
    </DashboardShell>
  );
}
