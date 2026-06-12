import { DashboardShell } from '@/components/layout/dashboard-shell';
import { QuestionBankWorkspace } from '@/components/question-bank/question-bank-workspace';

export default function QuestionBankSettingsPage() {
  return (
    <DashboardShell role="admin" title="Question Bank Settings">
      <QuestionBankWorkspace page="settings" portal="admin" />
    </DashboardShell>
  );
}
