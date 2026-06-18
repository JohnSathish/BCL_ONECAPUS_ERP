import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LibraryNaacReportsWorkspace } from '@/components/library/library-naac-reports-workspace';

export default function LibraryNaacReportsPage() {
  return (
    <DashboardShell role="admin" title="NAAC Library Reports">
      <LibraryNaacReportsWorkspace />
    </DashboardShell>
  );
}
