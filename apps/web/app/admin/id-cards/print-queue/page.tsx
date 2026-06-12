import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IdCardWorkspace } from '@/components/id-cards-module/id-card-workspace';

export default function IdCardPrintQueuePage() {
  return (
    <DashboardShell role="admin" title="Print Queue">
      <IdCardWorkspace page="print-queue" />
    </DashboardShell>
  );
}
