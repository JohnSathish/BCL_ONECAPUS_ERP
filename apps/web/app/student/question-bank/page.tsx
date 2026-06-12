import { DashboardShell } from '@/components/layout/dashboard-shell';
import { QuestionBankWorkspace } from '@/components/question-bank/question-bank-workspace';

export default function StudentQuestionBankPage() {
  return (
    <DashboardShell role="student" title="Question Bank">
      <QuestionBankWorkspace page="student" portal="student" />
    </DashboardShell>
  );
}
