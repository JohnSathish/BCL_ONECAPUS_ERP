'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LmsSettingsPanel } from '@/components/lms-module/lms-settings-panel';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AdminLmsSettingsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="LMS settings">
      <LmsSettingsPanel />
    </DashboardShell>
  );
}
