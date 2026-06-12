import { CertificatesWorkspace } from '@/components/certificates/certificates-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function CertificateAuditPage() {
  return (
    <DashboardShell role="admin" title="Certificate Audit Logs">
      <CertificatesWorkspace page="audit" />
    </DashboardShell>
  );
}
