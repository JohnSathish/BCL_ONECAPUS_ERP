import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LibraryWorkspace } from '@/components/library/library-workspace';

export default function LibraryCataloguePage() {
  return (
    <DashboardShell role="admin" title="Library Catalogue">
      <LibraryWorkspace page="catalogue" />
    </DashboardShell>
  );
}
