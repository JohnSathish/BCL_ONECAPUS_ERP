import { CertificatesWorkspace } from '@/components/certificates/certificates-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function CertificateVerificationPage() {
  return (
    <DashboardShell role="admin" title="Certificate Verification">
      <CertificatesWorkspace page="verification" />
    </DashboardShell>
  );
}
