import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LibraryMembersWorkspace } from '@/components/library/library-members-workspace';

export default function LibraryMembersPage() {
  return (
    <DashboardShell role="admin" title="Library Members">
      <LibraryMembersWorkspace />
    </DashboardShell>
  );
}
