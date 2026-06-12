import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LibraryWorkspace } from '@/components/library/library-workspace';

export default function LibrarySettingsPage() {
  return (
    <DashboardShell role="admin" title="Library Settings">
      <LibraryWorkspace page="settings" />
    </DashboardShell>
  );
}
