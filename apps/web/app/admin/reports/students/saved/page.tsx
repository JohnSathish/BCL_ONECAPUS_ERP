'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { StudentReportsShell } from '@/components/student-reports/student-reports-shell';

export default function SavedReportsPage() {
  return (
    <DashboardShell title="Student Reports">
      <StudentReportsShell
        title="Saved Reports"
        description="Quick access to your saved report configurations."
      >
        <CompactCard>
          <CompactCardHeader title="No Saved Reports Yet" />
          <CompactCardBody>
            <p className="text-sm text-muted-foreground">
              Saved reports from the custom builder and export center will appear here.
            </p>
          </CompactCardBody>
        </CompactCard>
      </StudentReportsShell>
    </DashboardShell>
  );
}
