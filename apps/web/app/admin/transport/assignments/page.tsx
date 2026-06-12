import { DashboardShell } from '@/components/layout/dashboard-shell';
import { TransportWorkspace } from '@/components/transport/transport-workspace';

export default function TransportAssignmentsPage() {
  return (
    <DashboardShell role="admin" title="Transport — Assignments">
      <TransportWorkspace page="assignments" />
    </DashboardShell>
  );
}
