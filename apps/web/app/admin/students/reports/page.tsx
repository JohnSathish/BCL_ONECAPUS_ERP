'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import {
  StudentFilterBar,
  type StudentFilters,
} from '@/components/student-records/student-filter-bar';
import { StudentDirectoryTable } from '@/components/student-records/student-directory-table';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentPermissions } from '@/hooks/use-student-permissions';
import { toShiftOptions } from '@/lib/shift-options';
import { fetchAcademicStreams } from '@/services/academic-engine';
import { fetchAdmissionBatches } from '@/services/academic-lifecycle';
import { fetchInstitutions } from '@/services/organization';
import { fetchPrograms } from '@/services/programs';
import { fetchShifts } from '@/services/shifts';
import {
  exportStudentsCsv,
  exportStudentsProfileXlsx,
  exportSubjectAllocationsXlsx,
  fetchAbcCoverage,
  fetchEnhancedStudentsSummary,
  fetchStudents,
} from '@/services/students';
import type { StudentExportParams } from '@/types/students';
import { apiErrorMessage } from '@/utils/api-error';
import { downloadBlob } from '@/utils/download-blob';

const emptyFilters: StudentFilters = {
  search: '',
  programVersionId: '',
  shiftId: '',
  batchId: '',
  semester: '',
  streamId: '',
  admissionStatus: '',
  academicStatus: '',
};

function filtersToParams(filters: StudentFilters): StudentExportParams {
  const opt = (v: string) => v || undefined;
  return {
    search: opt(filters.search),
    programVersionId: opt(filters.programVersionId),
    shiftId: opt(filters.shiftId),
    batchId: opt(filters.batchId),
    semester: opt(filters.semester),
    streamId: opt(filters.streamId),
    admissionStatus: opt(filters.admissionStatus),
    academicStatus: opt(filters.academicStatus),
    limit: 10_000,
  };
}

export default function StudentReportsPage() {
  const session = useRequireAuth();
  const perms = useStudentPermissions();
  const [filters, setFilters] = useState<StudentFilters>(emptyFilters);
  const [message, setMessage] = useState('');

  const exportParams = useMemo(() => filtersToParams(filters), [filters]);

  const summary = useQuery({
    queryKey: ['students', 'summary', 'enhanced'],
    queryFn: fetchEnhancedStudentsSummary,
    enabled: Boolean(session) && perms.canRead,
  });

  const abcCoverage = useQuery({
    queryKey: ['students', 'abc', 'coverage'],
    queryFn: fetchAbcCoverage,
    enabled: Boolean(session) && perms.canRead,
  });

  const preview = useQuery({
    queryKey: ['students', 'reports-preview', filters],
    queryFn: () =>
      fetchStudents({
        limit: 25,
        search: filters.search || undefined,
        programVersionId: filters.programVersionId || undefined,
        shiftId: filters.shiftId || undefined,
        batchId: filters.batchId || undefined,
        semester: filters.semester || undefined,
        streamId: filters.streamId || undefined,
        admissionStatus: filters.admissionStatus || undefined,
        academicStatus: filters.academicStatus || undefined,
      }),
    enabled: Boolean(session) && perms.canRead,
  });

  const exportMut = useMutation({
    mutationFn: async (kind: 'csv' | 'profile' | 'allocations') => {
      if (kind === 'csv') {
        const blob = await exportStudentsCsv(exportParams);
        downloadBlob(blob, 'students_report.csv');
      } else if (kind === 'profile') {
        const blob = await exportStudentsProfileXlsx(exportParams);
        downloadBlob(blob, 'students_profile_report.xlsx');
      } else {
        const blob = await exportSubjectAllocationsXlsx(exportParams);
        downloadBlob(blob, 'subject_allocations_report.xlsx');
      }
    },
    onSuccess: () => setMessage('Report exported.'),
    onError: (e) => setMessage(apiErrorMessage(e, 'Export failed')),
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

  const programVersions = useMemo(() => {
    const rows: { id: string; label: string }[] = [];
    for (const p of programs.data?.data ?? []) {
      for (const v of p.versions ?? []) {
        if (v.status === 'PUBLISHED') {
          rows.push({ id: v.id, label: `${p.code} v${v.version}` });
        }
      }
    }
    return rows;
  }, [programs.data]);

  if (!session) return null;

  const meta = preview.data?.meta;

  return (
    <DashboardShell role="admin" title="Student Reports">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Build filtered student reports and export to CSV or XLSX. Preview shows the first 25
          matching records.
        </p>

        {message ? (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{message}</p>
        ) : null}

        {summary.data ? (
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border border-border bg-card px-3 py-2 text-sm">
              <p className="text-muted-foreground">Total students</p>
              <p className="text-lg font-semibold">{summary.data.total}</p>
            </div>
            <div className="rounded-md border border-border bg-card px-3 py-2 text-sm">
              <p className="text-muted-foreground">Active users</p>
              <p className="text-lg font-semibold">{summary.data.activeUsers}</p>
            </div>
            <div className="rounded-md border border-border bg-card px-3 py-2 text-sm">
              <p className="text-muted-foreground">With programme</p>
              <p className="text-lg font-semibold">{summary.data.withProgram}</p>
            </div>
            <div className="rounded-md border border-border bg-card px-3 py-2 text-sm">
              <p className="text-muted-foreground">Registrations</p>
              <p className="text-lg font-semibold">{summary.data.registrations}</p>
            </div>
          </div>
        ) : null}

        {abcCoverage.data ? (
          <CompactCard>
            <CompactCardHeader
              title="ABC Coverage Report"
              description="Academic Bank of Credits ID availability for NEP / NAAC audits"
            />
            <CompactCardBody>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                  <p className="text-muted-foreground">Total students</p>
                  <p className="text-lg font-semibold">
                    {abcCoverage.data.totalStudents.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                  <p className="text-muted-foreground">ABC available</p>
                  <p className="text-lg font-semibold">
                    {abcCoverage.data.withAbcId.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                  <p className="text-muted-foreground">Missing ABC</p>
                  <p className="text-lg font-semibold">
                    {abcCoverage.data.missingAbcId.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                  <p className="text-muted-foreground">Coverage</p>
                  <p className="text-lg font-semibold">{abcCoverage.data.coveragePct}%</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/admin/students?abc=missing">
                  <Button type="button" size="sm" variant="outline">
                    View missing ABC
                  </Button>
                </Link>
                <Link href="/admin/students/abc-upload">
                  <Button type="button" size="sm" variant="outline">
                    Upload ABC IDs
                  </Button>
                </Link>
              </div>
            </CompactCardBody>
          </CompactCard>
        ) : null}

        <CompactCard>
          <CompactCardHeader title="Report filters" />
          <CompactCardBody className="space-y-3">
            <StudentFilterBar
              filters={filters}
              onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
              programOptions={programVersions}
              shiftOptions={toShiftOptions(shifts.data ?? [])}
              batchOptions={(batches.data ?? []).map((b) => ({
                id: b.id,
                label: b.batchCode,
              }))}
              streamOptions={(streams.data ?? []).map((s) => ({
                id: s.id,
                label: s.name,
              }))}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!perms.canExport || exportMut.isPending}
                onClick={() => exportMut.mutate('csv')}
              >
                Export CSV
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!perms.canExport || exportMut.isPending}
                onClick={() => exportMut.mutate('profile')}
              >
                Export profile XLSX
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!perms.canExport || exportMut.isPending}
                onClick={() => exportMut.mutate('allocations')}
              >
                Export allocations XLSX
              </Button>
              <Link href="/admin/students/export">
                <Button type="button" size="sm" variant="ghost">
                  Open export hub →
                </Button>
              </Link>
            </div>
          </CompactCardBody>
        </CompactCard>

        <CompactCard>
          <CompactCardHeader
            title="Preview"
            description={
              meta
                ? `${meta.total} matching · showing ${preview.data?.data.length ?? 0}`
                : 'Adjust filters to preview'
            }
          />
          <CompactCardBody>
            {preview.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading preview…</p>
            ) : (
              <StudentDirectoryTable rows={preview.data?.data ?? []} canManage={false} />
            )}
          </CompactCardBody>
        </CompactCard>
      </div>
    </DashboardShell>
  );
}
