'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ProfileVerificationWorkspace } from '@/components/students-module/profile-verification-workspace';

export default function ProfileVerificationHubPage() {
  return (
    <DashboardShell role="admin" title="Student Profile Verification" pageHeader={false}>
      <ProfileVerificationWorkspace mode="pending" />
    </DashboardShell>
  );
}
