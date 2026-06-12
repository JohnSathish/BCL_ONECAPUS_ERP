import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CertificatesWorkspace } from '@/components/certificates/certificates-workspace';

export default function StudentCertificatesPage() {
  return (
    <DashboardShell role="admin" title="Student Certificates">
      <CertificatesWorkspace />
    </DashboardShell>
  );
}
