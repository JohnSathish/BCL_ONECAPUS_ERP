import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IdCardWorkspace } from '@/components/id-cards-module/id-card-workspace';

export default function IdCardSettingsPage() {
  return (
    <DashboardShell role="admin" title="ID Card Settings">
      <IdCardWorkspace page="settings" />
    </DashboardShell>
  );
}
