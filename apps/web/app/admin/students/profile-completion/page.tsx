'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ProfileCompletionMonitor } from '@/components/students-module/profile-completion-monitor';

export default function ProfileCompletionMonitorPage() {
  return (
    <DashboardShell role="admin" title="Profile Completion Monitor" pageHeader={false}>
      <ProfileCompletionMonitor />
    </DashboardShell>
  );
}
