import { CertificatesWorkspace } from '@/components/certificates/certificates-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function BulkCertificateIssuePage() {
  return (
    <DashboardShell role="admin" title="Bulk Certificate Issue">
      <CertificatesWorkspace page="bulk" />
    </DashboardShell>
  );
}
