import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IdCardWorkspace } from '@/components/id-cards-module/id-card-workspace';

export default function IdCardReportsPage() {
  return (
    <DashboardShell role="admin" title="ID Card Reports">
      <IdCardWorkspace page="reports" />
    </DashboardShell>
  );
}
