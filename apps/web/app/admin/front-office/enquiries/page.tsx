import { DashboardShell } from '@/components/layout/dashboard-shell';
import { FrontOfficeWorkspace } from '@/components/front-office/front-office-workspace';

export default function FrontOfficeEnquiriesPage() {
  return (
    <DashboardShell role="admin" title="Front Office — Enquiries">
      <FrontOfficeWorkspace page="enquiries" />
    </DashboardShell>
  );
}
