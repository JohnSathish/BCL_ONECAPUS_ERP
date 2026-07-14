import { DashboardShell } from '@/components/layout/dashboard-shell';
import { InternshipWorkspace } from '@/components/enterprise/enterprise-module-workspaces';

export default function AdminInternshipPage() {
  return (
    <DashboardShell role="admin" title="Internship">
      <InternshipWorkspace />
    </DashboardShell>
  );
}
