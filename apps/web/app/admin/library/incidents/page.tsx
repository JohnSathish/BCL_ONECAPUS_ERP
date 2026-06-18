import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LibraryIncidentsWorkspace } from '@/components/library/library-incidents-workspace';

export default function LibraryIncidentsPage() {
  return (
    <DashboardShell role="admin" title="Library Incidents">
      <LibraryIncidentsWorkspace />
    </DashboardShell>
  );
}
