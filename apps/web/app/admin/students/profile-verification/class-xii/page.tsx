'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ProfileVerificationWorkspace } from '@/components/students-module/profile-verification-workspace';

export default function ClassXiiVerificationPage() {
  return (
    <DashboardShell role="admin" title="Class XII Verification">
      <ProfileVerificationWorkspace mode="class-xii" />
    </DashboardShell>
  );
}
