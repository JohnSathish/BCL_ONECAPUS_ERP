import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LibraryWorkspace } from '@/components/library/library-workspace';

export default function LibraryCirculationPage() {
  return (
    <DashboardShell role="admin" title="Library Circulation">
      <LibraryWorkspace page="circulation" />
    </DashboardShell>
  );
}
