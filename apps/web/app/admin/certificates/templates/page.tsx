import { CertificatesWorkspace } from '@/components/certificates/certificates-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function CertificateTemplatesPage() {
  return (
    <DashboardShell role="admin" title="Certificate Templates">
      <CertificatesWorkspace page="templates" />
    </DashboardShell>
  );
}
