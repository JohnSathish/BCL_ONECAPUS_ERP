import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AlumniWorkspace } from '@/components/enterprise/enterprise-module-workspaces';

export default function AdminAlumniPage() {
  return (
    <DashboardShell role="admin" title="Alumni">
      <AlumniWorkspace />
    </DashboardShell>
  );
}
