import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IntegrationsWorkspace } from '@/components/enterprise/enterprise-module-workspaces';

export default function AdminIntegrationsPage() {
  return (
    <DashboardShell role="admin" title="Integrations">
      <IntegrationsWorkspace />
    </DashboardShell>
  );
}
