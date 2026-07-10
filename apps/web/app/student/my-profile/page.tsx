'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { MyProfileWorkspace } from '@/components/student-portal/my-profile/my-profile-workspace';

export default function MyProfileDashboardPage() {
  return (
    <DashboardShell role="student" title="My Profile">
      <MyProfileWorkspace section="dashboard" />
    </DashboardShell>
  );
}
