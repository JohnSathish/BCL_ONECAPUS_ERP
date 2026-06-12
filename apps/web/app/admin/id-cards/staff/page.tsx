import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IdCardWorkspace } from '@/components/id-cards-module/id-card-workspace';

export default function IdCardStaffPage() {
  return (
    <DashboardShell role="admin" title="Staff Production Center">
      <IdCardWorkspace page="staff" />
    </DashboardShell>
  );
}
