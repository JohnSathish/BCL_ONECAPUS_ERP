import { CertificatesWorkspace } from '@/components/certificates/certificates-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function CertificateGeneratorPage() {
  return (
    <DashboardShell role="admin" title="Certificate Generator">
      <CertificatesWorkspace page="generator" />
    </DashboardShell>
  );
}
