import { DashboardShell } from '@/components/layout/dashboard-shell';
import { SyllabusWorkspace } from '@/components/syllabus-repository/syllabus-workspace';

export default function SyllabusRepositorySettingsPage() {
  return (
    <DashboardShell role="admin" title="Syllabus Repository Settings">
      <SyllabusWorkspace page="settings" portal="admin" />
    </DashboardShell>
  );
}
