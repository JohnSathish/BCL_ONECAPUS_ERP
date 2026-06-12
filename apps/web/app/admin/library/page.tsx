import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LibraryWorkspace } from '@/components/library/library-workspace';

export default function LibraryDashboardPage() {
  return (
    <DashboardShell role="admin" title="Library">
      <LibraryWorkspace page="dashboard" />
    </DashboardShell>
  );
}
