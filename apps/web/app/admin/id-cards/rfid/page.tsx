import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IdCardWorkspace } from '@/components/id-cards-module/id-card-workspace';

export default function IdCardRfidPage() {
  return (
    <DashboardShell role="admin" title="RFID Mapping">
      <IdCardWorkspace page="rfid" />
    </DashboardShell>
  );
}
