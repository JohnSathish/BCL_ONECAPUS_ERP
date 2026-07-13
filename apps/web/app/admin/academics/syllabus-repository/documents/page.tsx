import { DashboardShell } from '@/components/layout/dashboard-shell';
import { SyllabusWorkspace } from '@/components/syllabus-repository/syllabus-workspace';

export default function SyllabusRepositoryDocumentsPage() {
  return (
    <DashboardShell role="admin" title="Syllabus Documents">
      <SyllabusWorkspace page="documents" portal="admin" />
    </DashboardShell>
  );
}
