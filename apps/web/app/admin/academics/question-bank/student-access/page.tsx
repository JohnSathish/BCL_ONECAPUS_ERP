import { DashboardShell } from '@/components/layout/dashboard-shell';
import { QuestionBankWorkspace } from '@/components/question-bank/question-bank-workspace';

export default function QuestionBankStudentAccessPage() {
  return (
    <DashboardShell role="admin" title="Student Access">
      <QuestionBankWorkspace page="student-access" portal="admin" />
    </DashboardShell>
  );
}
