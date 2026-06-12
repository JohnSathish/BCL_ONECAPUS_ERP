import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IdCardWorkspace } from '@/components/id-cards-module/id-card-workspace';

export default function IdCardVerificationPage() {
  return (
    <DashboardShell role="admin" title="Verification Portal">
      <IdCardWorkspace page="verification" />
    </DashboardShell>
  );
}
