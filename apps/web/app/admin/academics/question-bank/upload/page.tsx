import { DashboardShell } from '@/components/layout/dashboard-shell';
import { QuestionBankWorkspace } from '@/components/question-bank/question-bank-workspace';

export default function QuestionBankUploadPage() {
  return (
    <DashboardShell role="admin" title="Upload Center">
      <QuestionBankWorkspace page="upload" portal="admin" />
    </DashboardShell>
  );
}
