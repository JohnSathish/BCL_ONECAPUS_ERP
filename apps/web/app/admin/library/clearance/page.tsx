import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LibraryClearanceWorkspace } from '@/components/library/library-clearance-workspace';

export default function LibraryClearancePage() {
  return (
    <DashboardShell role="admin" title="Library Clearance Card">
      <LibraryClearanceWorkspace />
    </DashboardShell>
  );
}
