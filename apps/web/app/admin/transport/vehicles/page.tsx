import { DashboardShell } from '@/components/layout/dashboard-shell';
import { TransportWorkspace } from '@/components/transport/transport-workspace';

export default function TransportVehiclesPage() {
  return (
    <DashboardShell role="admin" title="Transport — Vehicles">
      <TransportWorkspace page="vehicles" />
    </DashboardShell>
  );
}
