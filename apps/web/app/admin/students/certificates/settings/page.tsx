import { CertificatesWorkspace } from '@/components/certificates/certificates-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function CertificateSettingsPage() {
  return (
    <DashboardShell role="admin" title="Certificate Settings">
      <CertificatesWorkspace page="settings" />
    </DashboardShell>
  );
}
