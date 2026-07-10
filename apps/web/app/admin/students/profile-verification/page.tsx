'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ProfileVerificationWorkspace } from '@/components/students-module/profile-verification-workspace';

export default function ProfileVerificationHubPage() {
  return (
    <DashboardShell role="admin" title="Student Profile Verification">
      <ProfileVerificationWorkspace mode="pending" />
    </DashboardShell>
  );
}
