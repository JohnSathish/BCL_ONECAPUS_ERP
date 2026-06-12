import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IdCardWorkspace } from '@/components/id-cards-module/id-card-workspace';

export default function IdCardBulkPage() {
  return (
    <DashboardShell role="admin" title="Bulk Generation">
      <IdCardWorkspace page="bulk" />
    </DashboardShell>
  );
}
