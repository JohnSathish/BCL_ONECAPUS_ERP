import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LibraryAccessionWorkspace } from '@/components/library/library-accession-workspace';

export default function LibraryAccessionPage() {
  return (
    <DashboardShell role="admin" title="Accession Workflow">
      <LibraryAccessionWorkspace />
    </DashboardShell>
  );
}
