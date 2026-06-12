'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import {
  StudentFilterBar,
  type StudentFilters,
} from '@/components/student-records/student-filter-bar';
import { StudentDirectoryTable } from '@/components/student-records/student-directory-table';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchAcademicStreams } from '@/services/academic-engine';
import { fetchAdmissionBatches } from '@/services/academic-lifecycle';
import { fetchInstitutions } from '@/services/organization';
import { fetchPrograms } from '@/services/programs';
import { fetchShifts } from '@/services/shifts';
import { toShiftOptions } from '@/lib/shift-options';
import { fetchStudents } from '@/services/students';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/utils/cn';

const baseFilters: StudentFilters = {
  search: '',
  programVersionId: '',
  shiftId: '',
  batchId: '',
  semester: '',
  streamId: '',
  admissionStatus: '',
  academicStatus: 'Alumni',
};

export default function StudentAlumniPage() {
  const session = useRequireAuth();
  const [filters, setFilters] = useState<StudentFilters>(baseFilters);

  const institutions = useQuery({
    queryKey: ['org', 'institutions'],
    queryFn: fetchInstitutions,
    enabled: Boolean(session),
  });
  const institutionId = institutions.data?.[0]?.id ?? '';

  const students = useQuery({
    queryKey: ['students', 'alumni', filters],
    queryFn: () =>
      fetchStudents({
        limit: 100,
        search: filters.search || undefined,
        programVersionId: filters.programVersionId || undefined,
        shiftId: filters.shiftId || undefined,
        batchId: filters.batchId || undefined,
        semester: filters.semester || undefined,
        streamId: filters.streamId || undefined,
        academicStatus: filters.academicStatus || 'Alumni',
      }),
    enabled: Boolean(session),
  });

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

  return (
    <DashboardShell role="admin" title="Alumni">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Alumni records are students with alumni academic status. Update status from the student
          profile basic section.
        </p>
        <CompactCard>
          <CompactCardHeader title="Alumni directory" description="Filtered to alumni status" />
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
            <StudentDirectoryTable rows={students.data?.data ?? []} canManage={false} />
          </CompactCardBody>
        </CompactCard>
        <Link
          href="/admin/students"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          ← All students
        </Link>
      </div>
    </DashboardShell>
  );
}
