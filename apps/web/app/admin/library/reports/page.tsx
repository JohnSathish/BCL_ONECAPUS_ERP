import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LibraryReportsWorkspace } from '@/components/library/library-reports-workspace';

export default function LibraryReportsPage() {
  return (
    <DashboardShell role="admin" title="Library Reports">
      <LibraryReportsWorkspace />
    </DashboardShell>
  );
}
