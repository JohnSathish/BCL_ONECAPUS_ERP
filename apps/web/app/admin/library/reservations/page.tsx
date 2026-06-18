import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LibraryReservationsWorkspace } from '@/components/library/library-reservations-workspace';

export default function LibraryReservationsPage() {
  return (
    <DashboardShell role="admin" title="Library Reservations">
      <LibraryReservationsWorkspace />
    </DashboardShell>
  );
}
