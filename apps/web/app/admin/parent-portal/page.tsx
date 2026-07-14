import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ParentPortalAdminWorkspace } from '@/components/enterprise/enterprise-module-workspaces';

export default function AdminParentPortalPage() {
  return (
    <DashboardShell role="admin" title="Parent Portal">
      <ParentPortalAdminWorkspace />
    </DashboardShell>
  );
}
