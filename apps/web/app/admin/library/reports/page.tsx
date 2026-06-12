import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LibraryWorkspace } from '@/components/library/library-workspace';

export default function LibraryReportsPage() {
  return (
    <DashboardShell role="admin" title="Library Reports">
      <LibraryWorkspace page="reports" />
    </DashboardShell>
  );
}
