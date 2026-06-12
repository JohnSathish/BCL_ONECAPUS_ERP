import { DashboardShell } from '@/components/layout/dashboard-shell';
import { QuestionBankWorkspace } from '@/components/question-bank/question-bank-workspace';

export default function QuestionBankFacultyPage() {
  return (
    <DashboardShell role="admin" title="Faculty Workspace">
      <QuestionBankWorkspace page="faculty" portal="admin" />
    </DashboardShell>
  );
}
