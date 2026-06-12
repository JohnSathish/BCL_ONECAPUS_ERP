'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { QuestionBankWorkspace } from '@/components/question-bank/question-bank-workspace';

export default function StaffQuestionBankPage() {
  return (
    <DashboardShell role="staff" title="Question Bank">
      <div className="space-y-8">
        <QuestionBankWorkspace page="upload" portal="staff" />
        <QuestionBankWorkspace page="faculty" portal="staff" />
      </div>
    </DashboardShell>
  );
}
