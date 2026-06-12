import { CertificatesWorkspace } from '@/components/certificates/certificates-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function CertificateVerificationPortalPage() {
  return (
    <DashboardShell role="admin" title="Certificate Verification Portal">
      <CertificatesWorkspace page="verification" />
    </DashboardShell>
  );
}
