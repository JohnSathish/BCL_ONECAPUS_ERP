'use client';

import { NaacFeedbackPanel } from '@/components/naac-iqac-module/naac-feedback-panel';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Student Feedback">
      <div className="space-y-4 p-1">
        <div>
          <h1 className="text-xl font-semibold">Student Feedback</h1>
          <p className="text-sm text-muted-foreground">
            IQAC student satisfaction forms with enable/disable and date windows. Analytics stay
            anonymous; response list remains trackable for admin.
          </p>
        </div>
        <NaacFeedbackPanel />
      </div>
    </DashboardShell>
  );
}
