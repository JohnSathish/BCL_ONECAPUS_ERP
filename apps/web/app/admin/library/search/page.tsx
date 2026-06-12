import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LibrarySearchWorkspace } from '@/components/library/library-search-workspace';

export default function LibrarySearchPage() {
  return (
    <DashboardShell role="admin" title="Library Search">
      <LibrarySearchWorkspace />
    </DashboardShell>
  );
}
