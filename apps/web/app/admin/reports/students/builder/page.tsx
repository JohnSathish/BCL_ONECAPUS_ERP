'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { StudentReportsShell } from '@/components/student-reports/student-reports-shell';

export default function ReportBuilderPage() {
  return (
    <DashboardShell title="Student Reports">
      <StudentReportsShell
        title="Custom Report Builder"
        description="Drag-and-drop report builder with saved field selections."
      >
        <CompactCard>
          <CompactCardHeader title="Coming Soon" />
          <CompactCardBody>
            <p className="text-sm text-muted-foreground">
              The custom report builder will let you select fields, filters, grouping, and
              visualization types, then save templates for recurring institutional reports.
            </p>
          </CompactCardBody>
        </CompactCard>
      </StudentReportsShell>
    </DashboardShell>
  );
}
