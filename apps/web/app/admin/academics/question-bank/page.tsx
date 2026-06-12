import { DashboardShell } from '@/components/layout/dashboard-shell';
import { QuestionBankWorkspace } from '@/components/question-bank/question-bank-workspace';

export default function QuestionBankDashboardPage() {
  return (
    <DashboardShell role="admin" title="Question Bank">
      <QuestionBankWorkspace page="dashboard" portal="admin" />
    </DashboardShell>
  );
}
