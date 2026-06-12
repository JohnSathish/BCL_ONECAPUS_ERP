import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LibraryWorkspace } from '@/components/library/library-workspace';

export default function LibraryVisitorsPage() {
  return (
    <DashboardShell role="admin" title="Library Visitors">
      <LibraryWorkspace page="visitors" />
    </DashboardShell>
  );
}
