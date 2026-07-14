import { DashboardShell } from '@/components/layout/dashboard-shell';
import { HelpdeskWorkspace } from '@/components/enterprise/enterprise-module-workspaces';

export default function AdminHelpdeskPage() {
  return (
    <DashboardShell role="admin" title="Help Desk">
      <HelpdeskWorkspace />
    </DashboardShell>
  );
}
