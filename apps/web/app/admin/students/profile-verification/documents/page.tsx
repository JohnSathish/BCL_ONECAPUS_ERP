'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ProfileVerificationWorkspace } from '@/components/students-module/profile-verification-workspace';

export default function DocumentVerificationPage() {
  return (
    <DashboardShell role="admin" title="Document Verification">
      <ProfileVerificationWorkspace mode="documents" />
    </DashboardShell>
  );
}
