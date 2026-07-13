import { DashboardShell } from '@/components/layout/dashboard-shell';
import { SyllabusWorkspace } from '@/components/syllabus-repository/syllabus-workspace';

export default function StaffSyllabusRepositoryPage() {
  return (
    <DashboardShell role="staff" title="Syllabus Repository">
      <SyllabusWorkspace page="documents" portal="staff" />
    </DashboardShell>
  );
}
