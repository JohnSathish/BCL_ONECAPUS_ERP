'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { StudentReportsShell } from '@/components/student-reports/student-reports-shell';

export default function ScheduledReportsPage() {
  return (
    <DashboardShell title="Student Reports">
      <StudentReportsShell
        title="Scheduled Reports"
        description="Automated report generation and email delivery."
      >
        <CompactCard>
          <CompactCardHeader title="Coming Soon" />
          <CompactCardBody>
            <p className="text-sm text-muted-foreground">
              Schedule recurring exports to Excel or PDF for management, IQAC, and department heads.
            </p>
          </CompactCardBody>
        </CompactCard>
      </StudentReportsShell>
    </DashboardShell>
  );
}
