import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IdCardWorkspace } from '@/components/id-cards-module/id-card-workspace';

export default function IdCardsDashboardPage() {
  return (
    <DashboardShell role="admin" title="Identity & ID Cards">
      <IdCardWorkspace page="dashboard" />
    </DashboardShell>
  );
}
