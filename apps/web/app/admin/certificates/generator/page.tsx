import { Suspense } from 'react';
import { CertificatesWorkspace } from '@/components/certificates/certificates-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function CertificateGeneratorPage() {
  return (
    <DashboardShell role="admin" title="Certificate Generator">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading generator…</p>}>
        <CertificatesWorkspace page="generator" />
      </Suspense>
    </DashboardShell>
  );
}
