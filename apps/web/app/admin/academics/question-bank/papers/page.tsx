import { DashboardShell } from '@/components/layout/dashboard-shell';
import { QuestionBankWorkspace } from '@/components/question-bank/question-bank-workspace';

export default function QuestionBankPapersPage() {
  return (
    <DashboardShell role="admin" title="Previous Year Papers">
      <QuestionBankWorkspace page="papers" portal="admin" />
    </DashboardShell>
  );
}
