import { DashboardShell } from '@/components/layout/dashboard-shell';
import { FrontOfficeWorkspace } from '@/components/front-office/front-office-workspace';

export default function FrontOfficeDashboardPage() {
  return (
    <DashboardShell role="admin" title="Front Office">
      <FrontOfficeWorkspace page="dashboard" />
    </DashboardShell>
  );
}
