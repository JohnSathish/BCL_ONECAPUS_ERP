import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IdCardWorkspace } from '@/components/id-cards-module/id-card-workspace';

export default function IdCardReissuePage() {
  return (
    <DashboardShell role="admin" title="Card Reissue">
      <IdCardWorkspace page="reissue" />
    </DashboardShell>
  );
}
