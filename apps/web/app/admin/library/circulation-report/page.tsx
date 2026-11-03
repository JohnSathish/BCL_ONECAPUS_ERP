import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CirculationReportPage } from '@/components/library/circulation-report/circulation-report-page';

export default function LibraryCirculationReportPage() {
  return (
    <DashboardShell role="admin" title="Library Circulation Report">
      <CirculationReportPage />
    </DashboardShell>
  );
}
