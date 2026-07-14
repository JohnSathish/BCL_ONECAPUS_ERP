import { DashboardShell } from '@/components/layout/dashboard-shell';
import { WorkflowWorkspace } from '@/components/enterprise/enterprise-module-workspaces';

export default function AdminWorkflowPage() {
  return (
    <DashboardShell role="admin" title="Workflow Engine">
      <WorkflowWorkspace />
    </DashboardShell>
  );
}
