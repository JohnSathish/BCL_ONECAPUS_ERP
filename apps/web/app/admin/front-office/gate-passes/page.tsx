import { DashboardShell } from '@/components/layout/dashboard-shell';
import { FrontOfficeWorkspace } from '@/components/front-office/front-office-workspace';

export default function FrontOfficeGatePassesPage() {
  return (
    <DashboardShell role="admin" title="Front Office — Gate Pass">
      <FrontOfficeWorkspace page="gate-passes" />
    </DashboardShell>
  );
}
