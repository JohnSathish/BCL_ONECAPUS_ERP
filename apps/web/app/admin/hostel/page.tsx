import { DashboardShell } from '@/components/layout/dashboard-shell';
import { HostelWorkspace } from '@/components/enterprise/enterprise-module-workspaces';

export default function AdminHostelPage() {
  return (
    <DashboardShell role="admin" title="Hostel">
      <HostelWorkspace />
    </DashboardShell>
  );
}
