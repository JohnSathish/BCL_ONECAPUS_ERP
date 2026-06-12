import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LibraryWorkspace } from '@/components/library/library-workspace';

export default function LibraryReservationsPage() {
  return (
    <DashboardShell role="admin" title="Library Reservations">
      <LibraryWorkspace page="reservations" />
    </DashboardShell>
  );
}
