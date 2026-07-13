import { DashboardShell } from '@/components/layout/dashboard-shell';
import { SyllabusWorkspace } from '@/components/syllabus-repository/syllabus-workspace';

export default function SyllabusRepositoryWorkflowPage() {
  return (
    <DashboardShell role="admin" title="Syllabus Workflow">
      <SyllabusWorkspace page="workflow" portal="admin" />
    </DashboardShell>
  );
}
