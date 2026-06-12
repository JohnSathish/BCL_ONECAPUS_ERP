import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LibraryDigitalWorkspace } from '@/components/library/library-digital-workspace';

export default function LibraryResearchPage() {
  return (
    <DashboardShell role="admin" title="Research Repository">
      <LibraryDigitalWorkspace mode="research" />
    </DashboardShell>
  );
}
