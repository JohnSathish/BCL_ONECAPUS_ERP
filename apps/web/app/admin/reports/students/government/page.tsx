'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { DistributionReportPanel } from '@/components/student-reports/distribution-report-panel';
import {
  emptyReportFilters,
  StudentReportFiltersBar,
  toApiFilters,
} from '@/components/student-reports/student-report-filters';
import { StudentReportsShell } from '@/components/student-reports/student-reports-shell';
import { useStudentReportFilterOptions } from '@/components/student-reports/use-student-report-filters';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentPermissions } from '@/hooks/use-student-permissions';
import { fetchStudentDistributionReport } from '@/services/student-reports';

export default function GovernmentReportsPage() {
  const session = useRequireAuth();
  const perms = useStudentPermissions();
  const [filters, setFilters] = useState(emptyReportFilters);
  const apiFilters = useMemo(() => toApiFilters(filters), [filters]);
  const filterOptions = useStudentReportFilterOptions();

  const category = useQuery({
    queryKey: ['student-reports', 'category', apiFilters],
    queryFn: () => fetchStudentDistributionReport('category', apiFilters),
    enabled: Boolean(session) && perms.canRead,
  });

  const religion = useQuery({
    queryKey: ['student-reports', 'religion', apiFilters],
    queryFn: () => fetchStudentDistributionReport('religion', apiFilters),
    enabled: Boolean(session) && perms.canRead,
  });

  return (
    <DashboardShell title="Student Reports">
      <StudentReportsShell
        title="Government & Compliance Reports"
        description="Category, religion, and reservation statistics for NAAC, IQAC, and government submissions."
      >
        <StudentReportFiltersBar
          filters={filters}
          onChange={(p) => setFilters((f) => ({ ...f, ...p }))}
          {...filterOptions}
        />

        {category.data ? (
          <DistributionReportPanel
            title={category.data.title}
            total={category.data.total}
            buckets={category.data.buckets}
            crossTabs={category.data.crossTabs}
          />
        ) : null}

        {religion.data ? (
          <DistributionReportPanel
            title={religion.data.title}
            total={religion.data.total}
            buckets={religion.data.buckets}
            crossTabs={religion.data.crossTabs}
          />
        ) : null}
      </StudentReportsShell>
    </DashboardShell>
  );
}
