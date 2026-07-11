'use client';

import { FeedbackRespondentPanel } from '@/components/feedback/feedback-respondent-panel';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StudentFeedbackPage() {
  const session = useRequireAuth();
  if (!session) return null;

  return (
    <DashboardShell role="student" title="Feedback">
      <FeedbackRespondentPanel
        audience="STUDENT"
        heading="Student Feedback"
        description="Submit feedback only while the college has enabled the form and within the allowed dates."
      />
    </DashboardShell>
  );
}
