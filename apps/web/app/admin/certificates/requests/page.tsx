import { CertificatesWorkspace } from '@/components/certificates/certificates-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function CertificateRequestsPage() {
  return (
    <DashboardShell role="admin" title="Certificate Requests">
      <CertificatesWorkspace page="requests" />
    </DashboardShell>
  );
}
