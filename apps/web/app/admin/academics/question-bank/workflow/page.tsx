import { DashboardShell } from '@/components/layout/dashboard-shell';
import { QuestionBankWorkspace } from '@/components/question-bank/question-bank-workspace';

export default function QuestionBankWorkflowPage() {
  return (
    <DashboardShell role="admin" title="Approval Workflow">
      <QuestionBankWorkspace page="workflow" portal="admin" />
    </DashboardShell>
  );
}
