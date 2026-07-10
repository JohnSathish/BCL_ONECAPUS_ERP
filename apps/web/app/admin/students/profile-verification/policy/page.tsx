'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ProfileVerificationWorkspace } from '@/components/students-module/profile-verification-workspace';

export default function ProfileUpdatePolicyPage() {
  return (
    <DashboardShell role="admin" title="Profile Update Policy">
      <ProfileVerificationWorkspace mode="policy" />
    </DashboardShell>
  );
}
