import { CertificatesWorkspace } from '@/components/certificates/certificates-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function StudentCertificatePortalPage() {
  return (
    <DashboardShell role="student" title="My Certificates">
      <CertificatesWorkspace page="student" portal="student" />
    </DashboardShell>
  );
}
