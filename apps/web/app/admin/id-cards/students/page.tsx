import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IdCardWorkspace } from '@/components/id-cards-module/id-card-workspace';

export default function IdCardStudentsPage() {
  return (
    <DashboardShell role="admin" title="ID Card Production Center">
      <IdCardWorkspace page="students" />
    </DashboardShell>
  );
}
