import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LibraryDigitalWorkspace } from '@/components/library/library-digital-workspace';

export default function LibraryDigitalPage() {
  return (
    <DashboardShell role="admin" title="Digital Library">
      <LibraryDigitalWorkspace mode="digital" />
    </DashboardShell>
  );
}
