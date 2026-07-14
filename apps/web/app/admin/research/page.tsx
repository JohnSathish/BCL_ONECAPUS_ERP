import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ResearchWorkspace } from '@/components/enterprise/enterprise-module-workspaces';

export default function AdminResearchPage() {
  return (
    <DashboardShell role="admin" title="Research Grants">
      <ResearchWorkspace />
    </DashboardShell>
  );
}
