import { DashboardShell } from '@/components/layout/dashboard-shell';
import { PlacementWorkspace } from '@/components/enterprise/enterprise-module-workspaces';

export default function AdminPlacementPage() {
  return (
    <DashboardShell role="admin" title="Placement">
      <PlacementWorkspace />
    </DashboardShell>
  );
}
