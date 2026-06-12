import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LibraryWorkspace } from '@/components/library/library-workspace';

export default function LibraryVisitsPage() {
  return (
    <DashboardShell role="admin" title="Library Visits">
      <LibraryWorkspace page="visits" />
    </DashboardShell>
  );
}
