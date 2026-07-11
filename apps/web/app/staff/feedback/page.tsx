'use client';

import { useState } from 'react';
import { FeedbackRespondentPanel } from '@/components/feedback/feedback-respondent-panel';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';

export default function StaffFeedbackPage() {
  useRequireStaffPortal();
  const [audience, setAudience] = useState<'TEACHER' | 'ALUMNI'>('TEACHER');

  return (
    <DashboardShell role="staff" title="Feedback">
      <div className="mb-4 flex flex-wrap gap-2 px-1">
        <Button
          size="sm"
          variant={audience === 'TEACHER' ? 'default' : 'outline'}
          onClick={() => setAudience('TEACHER')}
        >
          Teacher forms
        </Button>
        <Button
          size="sm"
          variant={audience === 'ALUMNI' ? 'default' : 'outline'}
          onClick={() => setAudience('ALUMNI')}
        >
          Alumni forms
        </Button>
      </div>
      <FeedbackRespondentPanel
        key={audience}
        audience={audience}
        heading={audience === 'TEACHER' ? 'Teacher Feedback' : 'Alumni Feedback'}
        description={
          audience === 'TEACHER'
            ? 'Faculty feedback forms enabled by IQAC. Submit only within the open date window.'
            : 'Alumni feedback forms (for invited respondents). Submit only while enabled.'
        }
      />
    </DashboardShell>
  );
}
