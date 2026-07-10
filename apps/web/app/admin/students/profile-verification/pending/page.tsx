'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ProfileVerificationWorkspace } from '@/components/students-module/profile-verification-workspace';

export default function PendingProfileUpdatesPage() {
  return (
    <DashboardShell role="admin" title="Pending Profile Updates">
      <ProfileVerificationWorkspace mode="pending" />
    </DashboardShell>
  );
}
