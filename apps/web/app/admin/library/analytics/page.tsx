import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LibraryAnalyticsWorkspace } from '@/components/library/library-analytics-workspace';

export default function LibraryAnalyticsPage() {
  return (
    <DashboardShell role="admin" title="Reading Analytics">
      <LibraryAnalyticsWorkspace />
    </DashboardShell>
  );
}
