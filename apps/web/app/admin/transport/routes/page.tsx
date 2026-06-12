import { DashboardShell } from '@/components/layout/dashboard-shell';
import { TransportWorkspace } from '@/components/transport/transport-workspace';

export default function TransportRoutesPage() {
  return (
    <DashboardShell role="admin" title="Transport — Routes">
      <TransportWorkspace page="routes" />
    </DashboardShell>
  );
}
