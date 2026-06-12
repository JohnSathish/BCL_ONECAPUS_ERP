import { CertificatesWorkspace } from '@/components/certificates/certificates-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function CertificateAnalyticsPage() {
  return (
    <DashboardShell role="admin" title="Certificate Analytics">
      <CertificatesWorkspace page="analytics" />
    </DashboardShell>
  );
}
