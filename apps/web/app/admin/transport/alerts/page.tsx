import { DashboardShell } from '@/components/layout/dashboard-shell';
import { TransportCapacityAlertsPanel } from '@/components/transport/transport-phase2';

export default function TransportAlertsPage() {
  return (
    <DashboardShell role="admin" title="Transport — Capacity Alerts">
      <TransportCapacityAlertsPanel />
    </DashboardShell>
  );
}
