import { DashboardShell } from '@/components/layout/dashboard-shell';
import { TransportWorkspace } from '@/components/transport/transport-workspace';

export default function TransportDashboardPage() {
  return (
    <DashboardShell role="admin" title="Transport">
      <TransportWorkspace page="dashboard" />
    </DashboardShell>
  );
}
