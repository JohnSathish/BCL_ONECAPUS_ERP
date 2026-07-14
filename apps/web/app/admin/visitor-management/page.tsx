import { DashboardShell } from '@/components/layout/dashboard-shell';
import { VisitorManagementWorkspace } from '@/components/enterprise/enterprise-module-workspaces';

export default function AdminVisitorManagementPage() {
  return (
    <DashboardShell role="admin" title="Visitor Management">
      <VisitorManagementWorkspace />
    </DashboardShell>
  );
}
