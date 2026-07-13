import { DashboardShell } from '@/components/layout/dashboard-shell';
import { SyllabusWorkspace } from '@/components/syllabus-repository/syllabus-workspace';

export default function StudentSyllabusRepositoryPage() {
  return (
    <DashboardShell role="student" title="Syllabus Repository">
      <SyllabusWorkspace page="student" portal="student" />
    </DashboardShell>
  );
}
