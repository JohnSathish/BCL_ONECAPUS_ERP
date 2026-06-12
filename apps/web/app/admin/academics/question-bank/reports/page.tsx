import { DashboardShell } from '@/components/layout/dashboard-shell';
import { QuestionBankWorkspace } from '@/components/question-bank/question-bank-workspace';

export default function QuestionBankReportsPage() {
  return (
    <DashboardShell role="admin" title="Question Bank Reports">
      <QuestionBankWorkspace page="reports" portal="admin" />
    </DashboardShell>
  );
}
