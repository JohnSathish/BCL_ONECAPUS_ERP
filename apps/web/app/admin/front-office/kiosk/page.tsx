import { DashboardShell } from '@/components/layout/dashboard-shell';
import { FrontOfficeKioskDesk } from '@/components/front-office/front-office-phase2';

export default function FrontOfficeKioskPage() {
  return (
    <DashboardShell role="admin" title="Front Office — Kiosk Desk">
      <FrontOfficeKioskDesk />
    </DashboardShell>
  );
}
