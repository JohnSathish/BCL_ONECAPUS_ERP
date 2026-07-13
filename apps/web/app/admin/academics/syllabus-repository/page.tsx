import { DashboardShell } from '@/components/layout/dashboard-shell';
import { SyllabusWorkspace } from '@/components/syllabus-repository/syllabus-workspace';

export default function SyllabusRepositoryDashboardPage() {
  return (
    <DashboardShell role="admin" title="Syllabus Repository">
      <SyllabusWorkspace page="dashboard" portal="admin" />
    </DashboardShell>
  );
}
