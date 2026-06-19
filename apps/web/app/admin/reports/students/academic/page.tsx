'use client';

import { useState } from 'react';
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

const TABS = [
  { id: 'strength', label: 'Institution Strength' },
  { id: 'department', label: 'Department Strength' },
] as const;

export default function AcademicReportsPage() {
  const session = useRequireAuth();
  const perms = useStudentPermissions();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('strength');
  const [filters, setFilters] = useState(emptyReportFilters);
  const apiFilters = toApiFilters(filters);
  const filterOptions = useStudentReportFilterOptions();

  const strength = useQuery({
    queryKey: ['student-reports', 'strength', apiFilters],
    queryFn: () => fetchStudentDistributionReport('strength', apiFilters),
    enabled: Boolean(session) && perms.canRead && tab === 'strength',
  });

  const department = useQuery({
    queryKey: ['student-reports', 'department', apiFilters],
    queryFn: () => fetchStudentDistributionReport('department', apiFilters),
    enabled: Boolean(session) && perms.canRead && tab === 'department',
  });

  const data = tab === 'strength' ? strength.data : department.data;

  return (
    <DashboardShell title="Student Reports">
      <StudentReportsShell
        title="Academic Reports"
        description="Institution, programme, semester, and department strength analysis."
      >
        <StudentReportFiltersBar
          filters={filters}
          onChange={(p) => setFilters((f) => ({ ...f, ...p }))}
          {...filterOptions}
        />

        <div className="flex gap-2 print:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                tab === t.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {data && 'title' in data ? (
          <DistributionReportPanel
            title={data.title}
            total={data.total}
            buckets={data.buckets}
            crossTabs={data.crossTabs}
            extra={
              'activeStudents' in data && data.activeStudents !== undefined ? (
                <p className="text-sm text-muted-foreground">
                  Active: {data.activeStudents.toLocaleString()}
                </p>
              ) : null
            }
          />
        ) : null}

        {data && 'majorWise' in data && data.majorWise ? (
          <>
            <DistributionReportPanel
              title="Major Subject-wise"
              total={data.total}
              buckets={data.majorWise}
            />
            <DistributionReportPanel
              title="Minor Subject-wise"
              total={data.total}
              buckets={data.minorWise ?? []}
            />
          </>
        ) : null}
      </StudentReportsShell>
    </DashboardShell>
  );
}
