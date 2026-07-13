import { DashboardShell } from '@/components/layout/dashboard-shell';
import { SyllabusWorkspace } from '@/components/syllabus-repository/syllabus-workspace';

export default function SyllabusRepositoryUploadPage() {
  return (
    <DashboardShell role="admin" title="Upload Syllabus">
      <SyllabusWorkspace page="upload" portal="admin" />
    </DashboardShell>
  );
}
