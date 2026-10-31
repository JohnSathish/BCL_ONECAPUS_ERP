import { DashboardShell } from '@/components/layout/dashboard-shell';
import { OpacAdminPanel } from '@/components/library/opac-admin-panel';

export default function LibraryOpacAdminPage() {
  return (
    <DashboardShell role="admin" title="Library OPAC">
      <OpacAdminPanel />
    </DashboardShell>
  );
}
