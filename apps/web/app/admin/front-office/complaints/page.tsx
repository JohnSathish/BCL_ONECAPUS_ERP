import { DashboardShell } from '@/components/layout/dashboard-shell';
import { FrontOfficeWorkspace } from '@/components/front-office/front-office-workspace';

export default function FrontOfficeComplaintsPage() {
  return (
    <DashboardShell role="admin" title="Front Office — Complaints">
      <FrontOfficeWorkspace page="complaints" />
    </DashboardShell>
  );
}
