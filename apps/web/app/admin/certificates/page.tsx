import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CertificatesWorkspace } from '@/components/certificates/certificates-workspace';

export default function CertificatesDashboardPage() {
  return (
    <DashboardShell role="admin" title="Certificates">
      <CertificatesWorkspace />
    </DashboardShell>
  );
}
