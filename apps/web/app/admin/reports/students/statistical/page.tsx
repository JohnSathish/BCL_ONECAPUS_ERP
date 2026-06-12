'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { BarChartWidget } from '@/components/analytics/charts/bar-chart-widget';
import {
  emptyReportFilters,
  StudentReportFiltersBar,
  toApiFilters,
} from '@/components/student-reports/student-report-filters';
import { StudentReportsShell } from '@/components/student-reports/student-reports-shell';
import { useStudentReportFilterOptions } from '@/components/student-reports/use-student-report-filters';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentPermissions } from '@/hooks/use-student-permissions';
import { fetchStudentReportDashboard } from '@/services/student-reports';

export default function StatisticalReportsPage() {
  const session = useRequireAuth();
  const perms = useStudentPermissions();
  const [filters, setFilters] = useState(emptyReportFilters);
  const apiFilters = useMemo(() => toApiFilters(filters), [filters]);
  const filterOptions = useStudentReportFilterOptions();

  const dashboard = useQuery({
    queryKey: ['student-reports', 'statistical', apiFilters],
    queryFn: () => fetchStudentReportDashboard(apiFilters),
    enabled: Boolean(session) && perms.canRead,
  });

  const d = dashboard.data;
  const toChart = (buckets: { label: string; count: number }[]) =>
    buckets.map((b) => ({ label: b.label, value: b.count }));

  return (
    <DashboardShell title="Student Reports">
      <StudentReportsShell
        title="Statistical Reports"
        description="Consolidated statistical summaries for management and accreditation."
      >
        <StudentReportFiltersBar
          filters={filters}
          onChange={(p) => setFilters((f) => ({ ...f, ...p }))}
          {...filterOptions}
        />

        {d ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <CompactCard>
              <CompactCardHeader title="Shift-wise" />
              <CompactCardBody>
                <BarChartWidget data={toChart(d.shiftWise)} height={220} />
              </CompactCardBody>
            </CompactCard>
            <CompactCard>
              <CompactCardHeader title="Semester Trends" />
              <CompactCardBody>
                <BarChartWidget data={toChart(d.semesterWise)} height={220} />
              </CompactCardBody>
            </CompactCard>
            <CompactCard>
              <CompactCardHeader title="Gender Statistics" />
              <CompactCardBody>
                <BarChartWidget data={toChart(d.genderWise)} height={220} />
              </CompactCardBody>
            </CompactCard>
            <CompactCard>
              <CompactCardHeader title="Category Statistics" />
              <CompactCardBody>
                <BarChartWidget data={toChart(d.categoryWise)} height={220} layout="vertical" />
              </CompactCardBody>
            </CompactCard>
          </div>
        ) : null}
      </StudentReportsShell>
    </DashboardShell>
  );
}
