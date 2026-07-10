'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ProfileVerificationWorkspace } from '@/components/students-module/profile-verification-workspace';

export default function ProfileCompletionDashboardPage() {
  return (
    <DashboardShell role="admin" title="Profile Completion Dashboard">
      <ProfileVerificationWorkspace mode="completion" />
    </DashboardShell>
  );
}
