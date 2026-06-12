import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IdCardVerificationReportCenter } from '@/components/id-cards/id-card-verification-report-center';

export default function IdCardVerificationReportPage() {
  return (
    <DashboardShell role="admin" title="ID Verification Report">
      <IdCardVerificationReportCenter />
    </DashboardShell>
  );
}
