'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import {
  StudentFilterBar,
  type StudentFilters,
} from '@/components/student-records/student-filter-bar';
import { StudentDirectoryTable } from '@/components/student-records/student-directory-table';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { todayIsoDate } from '@/utils/format-date';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentPermissions } from '@/hooks/use-student-permissions';
import { toShiftOptions } from '@/lib/shift-options';
import { fetchAcademicStreams } from '@/services/academic-engine';
import { fetchAdmissionBatches } from '@/services/academic-lifecycle';
import { fetchInstitutions } from '@/services/organization';
import { fetchPrograms } from '@/services/programs';
import { fetchShifts } from '@/services/shifts';
import { createLifecycleEvent, fetchStudents } from '@/services/students';
import type { LifecycleEventType } from '@/types/students';
import { apiErrorMessage } from '@/utils/api-error';

const alumniFilters: StudentFilters = {
  search: '',
  programVersionId: '',
  shiftId: '',
  batchId: '',
  semester: '',
  streamId: '',
  admissionStatus: '',
  academicStatus: 'Alumni',
};

const archiveEvents: { type: LifecycleEventType; label: string; description: string }[] = [
  { type: 'ALUMNI', label: 'Alumni', description: 'Mark as graduated / alumni eligible' },
  { type: 'DEACTIVATE', label: 'Deactivate', description: 'Deactivate login and mark inactive' },
];

export default function StudentArchivePage() {
  const session = useRequireAuth();
  const perms = useStudentPermissions();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [eventType, setEventType] = useState<LifecycleEventType>('ALUMNI');
  const [effectiveDate, setEffectiveDate] = useState(() => todayIsoDate());
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [alumniFiltersState, setAlumniFiltersState] = useState<StudentFilters>(alumniFilters);

  const students = useQuery({
    queryKey: ['students', 'archive', search],
    queryFn: () => fetchStudents({ limit: 20, search: search || undefined }),
    enabled: Boolean(session) && search.length >= 2,
  });

  const institutions = useQuery({
    queryKey: ['org', 'institutions'],
    queryFn: fetchInstitutions,
    enabled: Boolean(session),
  });
  const institutionId = institutions.data?.[0]?.id ?? '';

  const alumni = useQuery({
    queryKey: ['students', 'archive-alumni', alumniFiltersState],
    queryFn: () =>
      fetchStudents({
        limit: 100,
        search: alumniFiltersState.search || undefined,
        programVersionId: alumniFiltersState.programVersionId || undefined,
        shiftId: alumniFiltersState.shiftId || undefined,
        batchId: alumniFiltersState.batchId || undefined,
        semester: alumniFiltersState.semester || undefined,
        streamId: alumniFiltersState.streamId || undefined,
        academicStatus: 'Alumni',
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

  const selected = (students.data?.data ?? []).find((s) => s.id === selectedId);
  const activeEvent = archiveEvents.find((e) => e.type === eventType)!;

  const submitMut = useMutation({
    mutationFn: () =>
      createLifecycleEvent({
        studentId: selectedId,
        eventType,
        effectiveDate,
        reason: reason || undefined,
      }),
    onSuccess: () => {
      setMessage(`${activeEvent.label} event recorded successfully.`);
      setReason('');
      void qc.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Archive event failed')),
  });

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Student Archive">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Alumni graduation and deactivation workflow. Archived students appear in the alumni
          directory below.
        </p>

        {message ? (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{message}</p>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <CompactCard>
            <CompactCardHeader
              title="Find student"
              description="Search by enrollment number or name"
            />
            <CompactCardBody className="space-y-3">
              <Input
                placeholder="Type at least 2 characters…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedId('');
                }}
              />
              <ul className="divide-y divide-border rounded-md border border-border text-sm">
                {(students.data?.data ?? []).map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>
                      {row.enrollmentNumber} — {row.fullName}
                    </span>
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => setSelectedId(row.id)}
                    >
                      {selectedId === row.id ? 'Selected' : 'Select'}
                    </button>
                  </li>
                ))}
              </ul>
            </CompactCardBody>
          </CompactCard>

          <CompactCard>
            <CompactCardHeader
              title="Archive event"
              description={
                selected
                  ? `${selected.enrollmentNumber} · ${selected.fullName}`
                  : 'Select a student first'
              }
            />
            <CompactCardBody className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {archiveEvents.map((ev) => (
                  <Button
                    key={ev.type}
                    type="button"
                    size="sm"
                    variant={eventType === ev.type ? 'default' : 'outline'}
                    onClick={() => setEventType(ev.type)}
                  >
                    {ev.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{activeEvent.description}</p>
              <DateInput value={effectiveDate} onChange={setEffectiveDate} />
              <Input
                placeholder="Reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button
                type="button"
                disabled={!selectedId || !perms.canManage || submitMut.isPending}
                onClick={() => submitMut.mutate()}
              >
                {submitMut.isPending ? 'Submitting…' : `Create ${activeEvent.label} event`}
              </Button>
            </CompactCardBody>
          </CompactCard>
        </div>

        <CompactCard>
          <CompactCardHeader title="Alumni directory" description="Filtered to alumni status" />
          <CompactCardBody className="space-y-3">
            <StudentFilterBar
              filters={alumniFiltersState}
              onChange={(patch) => setAlumniFiltersState((f) => ({ ...f, ...patch }))}
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
            <StudentDirectoryTable rows={alumni.data?.data ?? []} canManage={false} />
          </CompactCardBody>
        </CompactCard>

        <Link
          href="/admin/students/alumni"
          className="text-sm text-primary underline-offset-2 hover:underline"
        >
          View full alumni page →
        </Link>
      </div>
    </DashboardShell>
  );
}
