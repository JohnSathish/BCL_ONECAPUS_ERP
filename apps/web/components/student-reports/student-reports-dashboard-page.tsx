'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Printer, Users } from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { BarChartWidget } from '@/components/analytics/charts/bar-chart-widget';
import { DonutChartWidget } from '@/components/analytics/charts/donut-chart-widget';
import { DistributionReportPanel } from '@/components/student-reports/distribution-report-panel';
import {
  emptyReportFilters,
  StudentReportFiltersBar,
  toApiFilters,
} from '@/components/student-reports/student-report-filters';
import { StudentReportsShell } from '@/components/student-reports/student-reports-shell';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentPermissions } from '@/hooks/use-student-permissions';
import { toShiftOptions } from '@/lib/shift-options';
import { fetchAcademicStreams } from '@/services/academic-engine';
import { fetchAdmissionBatches } from '@/services/academic-lifecycle';
import { fetchDepartments } from '@/services/organization';
import { fetchInstitutions } from '@/services/organization';
import { fetchPrograms } from '@/services/programs';
import { fetchShifts } from '@/services/shifts';
import { exportStudentReport, fetchStudentReportDashboard } from '@/services/student-reports';
import { apiErrorMessage } from '@/utils/api-error';

function toChart(buckets: { label: string; count: number }[]) {
  return buckets.map((b) => ({ label: b.label, value: b.count }));
}

export function StudentReportsDashboardPage() {
  const session = useRequireAuth();
  const perms = useStudentPermissions();
  const [filters, setFilters] = useState(emptyReportFilters);
  const [message, setMessage] = useState('');
  const apiFilters = useMemo(() => toApiFilters(filters), [filters]);

  const dashboard = useQuery({
    queryKey: ['student-reports', 'dashboard', apiFilters],
    queryFn: () => fetchStudentReportDashboard(apiFilters),
    enabled: Boolean(session) && perms.canRead,
  });

  const institutions = useQuery({
    queryKey: ['org', 'institutions'],
    queryFn: fetchInstitutions,
    enabled: Boolean(session),
  });
  const institutionId = institutions.data?.[0]?.id ?? '';

  const programs = useQuery({
    queryKey: ['catalog', 'programs'],
    queryFn: () => fetchPrograms(1),
    enabled: Boolean(session),
  });
  const shifts = useQuery({
    queryKey: ['shifts', 'ACTIVE'],
    queryFn: () => fetchShifts({ status: 'ACTIVE' }),
    enabled: Boolean(session),
  });
  const streams = useQuery({
    queryKey: ['academic-engine', 'streams'],
    queryFn: fetchAcademicStreams,
    enabled: Boolean(session),
  });
  const batches = useQuery({
    queryKey: ['academic-lifecycle', 'batches', institutionId],
    queryFn: () => fetchAdmissionBatches(institutionId),
    enabled: Boolean(session) && Boolean(institutionId),
  });
  const departments = useQuery({
    queryKey: ['org', 'departments', institutionId],
    queryFn: () => fetchDepartments({ institutionId, scope: 'academic', status: 'ACTIVE' }),
    enabled: Boolean(session) && Boolean(institutionId),
  });

  const programVersions = useMemo(() => {
    const rows: { id: string; label: string }[] = [];
    for (const p of programs.data?.data ?? []) {
      for (const v of p.versions ?? []) {
        if (v.status === 'PUBLISHED') rows.push({ id: v.id, label: `${p.code} v${v.version}` });
      }
    }
    return rows;
  }, [programs.data]);

  const exportMut = useMutation({
    mutationFn: (format: 'xlsx' | 'csv') => exportStudentReport('dashboard', format, apiFilters),
    onSuccess: () => setMessage('Dashboard exported.'),
    onError: (e) => setMessage(apiErrorMessage(e, 'Export failed')),
  });

  const d = dashboard.data;

  return (
    <DashboardShell title="Student Reports">
      <StudentReportsShell
        title="Student Reports & Analytics"
        description="Institution-wide reporting from student master data, academic mappings, and demographics."
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
          </>
        }
      >
        <StudentReportFiltersBar
          filters={filters}
          onChange={(p) => setFilters((f) => ({ ...f, ...p }))}
          programOptions={programVersions}
          shiftOptions={toShiftOptions(shifts.data ?? [])}
          batchOptions={(batches.data ?? []).map((b) => ({ id: b.id, label: b.batchCode }))}
          streamOptions={(streams.data ?? []).map((s) => ({ id: s.id, label: s.name }))}
          departmentOptions={(departments.data ?? []).map((d) => ({ id: d.id, label: d.name }))}
        />

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

        {dashboard.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading analytics…</p>
        ) : d ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <CompactCard>
                <CompactCardBody className="flex items-center gap-3 pt-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Students</p>
                    <p className="text-2xl font-bold">{d.totalStudents.toLocaleString()}</p>
                  </div>
                </CompactCardBody>
              </CompactCard>
              <CompactCard>
                <CompactCardBody className="pt-4">
                  <p className="text-xs text-muted-foreground">Active Students</p>
                  <p className="text-2xl font-bold">{d.activeStudents.toLocaleString()}</p>
                </CompactCardBody>
              </CompactCard>
              <CompactCard>
                <CompactCardBody className="pt-4">
                  <p className="text-xs text-muted-foreground">Programmes</p>
                  <p className="text-2xl font-bold">{d.programmeWise.length}</p>
                </CompactCardBody>
              </CompactCard>
              <CompactCard>
                <CompactCardBody className="pt-4">
                  <p className="text-xs text-muted-foreground">Last Updated</p>
                  <p className="text-sm font-medium">{new Date(d.updatedAt).toLocaleString()}</p>
                </CompactCardBody>
              </CompactCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <CompactCard>
                <CompactCardHeader title="Programme-wise Strength" />
                <CompactCardBody>
                  <BarChartWidget data={toChart(d.programmeWise)} height={240} layout="vertical" />
                </CompactCardBody>
              </CompactCard>
              <CompactCard>
                <CompactCardHeader title="Semester-wise Strength" />
                <CompactCardBody>
                  <BarChartWidget data={toChart(d.semesterWise)} height={240} />
                </CompactCardBody>
              </CompactCard>
              <CompactCard>
                <CompactCardHeader title="Gender Distribution" />
                <CompactCardBody>
                  <DonutChartWidget data={toChart(d.genderWise)} />
                </CompactCardBody>
              </CompactCard>
              <CompactCard>
                <CompactCardHeader title="Category Distribution" />
                <CompactCardBody>
                  <DonutChartWidget data={toChart(d.categoryWise)} />
                </CompactCardBody>
              </CompactCard>
            </div>

            <DistributionReportPanel
              title="Shift-wise Strength"
              total={d.totalStudents}
              buckets={d.shiftWise}
            />
          </>
        ) : null}
      </StudentReportsShell>
    </DashboardShell>
  );
}
