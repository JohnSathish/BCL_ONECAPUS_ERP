'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ProfileVerificationWorkspace } from '@/components/students-module/profile-verification-workspace';

export default function ProfileUpdateHistoryPage() {
  return (
    <DashboardShell role="admin" title="Profile Update History">
      <ProfileVerificationWorkspace mode="history" />
    </DashboardShell>
  );
}
