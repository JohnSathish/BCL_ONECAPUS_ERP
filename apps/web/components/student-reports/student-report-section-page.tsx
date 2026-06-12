'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Printer } from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
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
import {
  exportStudentReport,
  fetchStudentCombinationsReport,
  fetchStudentDistributionReport,
  type AgeReport,
  type DistributionReport,
  type StudentReportType,
} from '@/services/student-reports';
import { apiErrorMessage } from '@/utils/api-error';

type Props = {
  title: string;
  description: string;
  reportType: StudentReportType;
  mode?: 'distribution' | 'combinations' | 'age';
};

export function StudentReportSectionPage({
  title,
  description,
  reportType,
  mode = 'distribution',
}: Props) {
  const session = useRequireAuth();
  const perms = useStudentPermissions();
  const [filters, setFilters] = useState(emptyReportFilters);
  const [message, setMessage] = useState('');
  const apiFilters = useMemo(() => toApiFilters(filters), [filters]);
  const filterOptions = useStudentReportFilterOptions();

  const report = useQuery({
    queryKey: ['student-reports', reportType, apiFilters],
    queryFn: async () => {
      if (mode === 'combinations') return fetchStudentCombinationsReport(apiFilters);
      return fetchStudentDistributionReport(
        reportType as Exclude<StudentReportType, 'dashboard' | 'combinations'>,
        apiFilters,
      );
    },
    enabled: Boolean(session) && perms.canRead,
  });

  const exportMut = useMutation({
    mutationFn: (format: 'xlsx' | 'csv') => exportStudentReport(reportType, format, apiFilters),
    onSuccess: () => setMessage('Report exported.'),
    onError: (e) => setMessage(apiErrorMessage(e, 'Export failed')),
  });

  const data = report.data;

  return (
    <DashboardShell title="Student Reports">
      <StudentReportsShell
        title={title}
        description={description}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exportMut.isPending}
              onClick={() => exportMut.mutate('xlsx')}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exportMut.isPending}
              onClick={() => exportMut.mutate('csv')}
            >
              CSV
            </Button>
          </>
        }
      >
        <StudentReportFiltersBar
          filters={filters}
          onChange={(p) => setFilters((f) => ({ ...f, ...p }))}
          {...filterOptions}
        />

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

        {report.isLoading ? <p className="text-sm text-muted-foreground">Loading report…</p> : null}

        {mode === 'combinations' && data && 'combinations' in data ? (
          <CompactCard>
            <CompactCardHeader
              title="Subject Combination Analysis"
              description={`${data.total.toLocaleString()} students in scope`}
            />
            <CompactCardBody>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Major</th>
                      <th className="pb-2 font-medium">Minor</th>
                      <th className="pb-2 font-medium">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.combinations.map((c) => (
                      <tr key={`${c.major}-${c.minor}`} className="border-b border-border/40">
                        <td className="py-1.5">{c.major}</td>
                        <td className="py-1.5">{c.minor}</td>
                        <td className="py-1.5 tabular-nums">{c.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CompactCardBody>
          </CompactCard>
        ) : null}

        {mode === 'age' && data && 'averageAge' in data ? (
          <AgeReportView report={data as AgeReport} />
        ) : null}

        {mode === 'distribution' && data && 'buckets' in data ? (
          <DistributionReportView report={data as DistributionReport} />
        ) : null}
      </StudentReportsShell>
    </DashboardShell>
  );
}

function DistributionReportView({ report }: { report: DistributionReport }) {
  return (
    <>
      <DistributionReportPanel
        title={report.title}
        total={report.total}
        buckets={report.buckets}
        crossTabs={report.crossTabs}
        extra={
          report.activeStudents !== undefined ? (
            <p className="text-sm text-muted-foreground">
              Active students: {report.activeStudents.toLocaleString()}
            </p>
          ) : report.withMobile !== undefined ? (
            <p className="text-sm text-muted-foreground">
              Mobile: {report.withMobile} · Email: {report.withEmail}
            </p>
          ) : null
        }
      />
      {report.academicYearWise?.length ? (
        <DistributionReportPanel
          title="Academic Year-wise"
          total={report.total}
          buckets={report.academicYearWise}
        />
      ) : null}
      {report.majorWise?.length ? (
        <DistributionReportPanel
          title="Major Subject-wise"
          total={report.total}
          buckets={report.majorWise}
        />
      ) : null}
      {report.minorWise?.length ? (
        <DistributionReportPanel
          title="Minor Subject-wise"
          total={report.total}
          buckets={report.minorWise}
        />
      ) : null}
    </>
  );
}

function AgeReportView({ report }: { report: AgeReport }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <CompactCard>
          <CompactCardBody className="pt-4">
            <p className="text-xs text-muted-foreground">Average Age</p>
            <p className="text-2xl font-bold">{report.averageAge ?? '—'}</p>
          </CompactCardBody>
        </CompactCard>
        <CompactCard>
          <CompactCardBody className="pt-4">
            <p className="text-xs text-muted-foreground">Youngest</p>
            <p className="text-sm font-medium">
              {report.youngest ? `${report.youngest.name} (${report.youngest.age})` : '—'}
            </p>
          </CompactCardBody>
        </CompactCard>
        <CompactCard>
          <CompactCardBody className="pt-4">
            <p className="text-xs text-muted-foreground">Oldest</p>
            <p className="text-sm font-medium">
              {report.oldest ? `${report.oldest.name} (${report.oldest.age})` : '—'}
            </p>
          </CompactCardBody>
        </CompactCard>
      </div>
      <DistributionReportPanel
        title="Age Distribution"
        total={report.total}
        buckets={report.buckets}
      />
    </>
  );
}
