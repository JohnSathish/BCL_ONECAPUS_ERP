'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { RegistrationImportDialog } from '@/components/academic-engine/registration-import-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  autoAssignRegistration,
  bulkGenerateRegistrations,
  fetchStudentRegistrationContext,
} from '@/services/admin-registration';
import {
  fetchStudentSemesterRegistrations,
  type StudentSemesterRegistrationRow,
} from '@/services/students';
import type { StudentProfile } from '@/types/students';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { formatCourseDisplayTitle } from '@/utils/format-course-title';

type EnrollmentRow = StudentProfile['sectionEnrollments'][number];

type RegistrationSummary = {
  id: string;
  status: string;
  semesterSequence: number;
};

function normalizeCategory(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

type TableRow = EnrollmentRow | StudentSemesterRegistrationRow;

function isApiRow(row: TableRow): row is StudentSemesterRegistrationRow {
  return 'course' in row && typeof row.course === 'object';
}

export function StudentSubjectsTab({ profile }: { profile: StudentProfile }) {
  const qc = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const [semTab, setSemTab] = useState<number | 'all'>('all');
  const [actionMessage, setActionMessage] = useState('');

  const registrationsQuery = useQuery({
    queryKey: ['students', profile.id, 'semester-registrations'],
    queryFn: () => fetchStudentSemesterRegistrations(profile.id),
  });

  const trackContextQuery = useQuery({
    queryKey: ['students', profile.id, 'registration-track-context'],
    queryFn: () => fetchStudentRegistrationContext(profile.id),
  });

  const enrollmentSource = registrationsQuery.data?.length
    ? registrationsQuery.data
    : profile.sectionEnrollments;

  const semIds = useMemo(() => {
    const set = new Set<number>();
    for (const row of enrollmentSource) {
      const sem = isApiRow(row) ? row.semesterSequence : row.semesterSequence;
      if (sem) set.add(sem);
    }
    return [...set].sort((a, b) => a - b);
  }, [enrollmentSource]);

  const rows = useMemo(() => {
    if (semTab === 'all') return enrollmentSource;
    return enrollmentSource.filter((r) =>
      isApiRow(r) ? r.semesterSequence === semTab : r.semesterSequence === semTab,
    );
  }, [enrollmentSource, semTab]);

  const bySemester = useMemo(() => {
    const map = new Map<number, TableRow[]>();
    for (const row of enrollmentSource) {
      const sem = isApiRow(row) ? row.semesterSequence : (row.semesterSequence ?? 0);
      if (!map.has(sem)) map.set(sem, []);
      map.get(sem)!.push(row);
    }
    return map;
  }, [enrollmentSource]);

  const nepGroups = profile.nepCategoryGroups ?? {};
  const semId = (profile.registrations as { semesterId?: string }[])?.[0]?.semesterId ?? '';

  const creditTotal = useMemo(
    () =>
      rows.reduce((sum, row) => {
        if (isApiRow(row)) return sum + (row.course.credits ?? 0);
        return sum + (row.credits ?? 0);
      }, 0),
    [rows],
  );

  const currentRegistration = useMemo(() => {
    const registrations = profile.registrations as RegistrationSummary[];
    return (
      registrations.find((r) => r.semesterSequence === profile.semester) ?? registrations[0] ?? null
    );
  }, [profile.registrations, profile.semester]);

  const autoAssignMut = useMutation({
    mutationFn: async () => {
      const draftReg = currentRegistration?.status === 'draft' ? currentRegistration : null;
      if (draftReg) {
        return autoAssignRegistration(draftReg.id, 'COMPULSORY_ONLY');
      }
      const ctx = await fetchStudentRegistrationContext(profile.id);
      if (!ctx.semesterId) throw new Error('No active semester found for this student.');
      const result = await bulkGenerateRegistrations({
        semesterId: ctx.semesterId,
        semesterSequence: ctx.semesterSequence,
        mode: 'COMPULSORY_ONLY',
        studentIds: [profile.id],
      });
      const row = result.results[0];
      if (!row?.ok) throw new Error(row?.error ?? 'Compulsory assignment failed');
      return result;
    },
    onSuccess: () => {
      setActionMessage('Compulsory subjects assigned.');
      void qc.invalidateQueries({ queryKey: ['students', profile.id, 'profile'] });
      void qc.invalidateQueries({ queryKey: ['students', profile.id, 'semester-registrations'] });
    },
    onError: (e) => setActionMessage(apiErrorMessage(e, 'Auto-assign failed')),
  });

  return (
    <div className="space-y-4">
      {trackContextQuery.data?.majorMinorTrack?.isTrackLocked ||
      trackContextQuery.data?.vtcTrack?.trackGroupCode ? (
        <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
          <p className="font-medium">Academic track summary</p>
          {trackContextQuery.data.majorMinorTrack?.isTrackLocked ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Major/Minor track locked
              {trackContextQuery.data.majorMinorTrack.majorSubject
                ? ` · Major: ${trackContextQuery.data.majorMinorTrack.majorSubject.name}`
                : ''}
              {trackContextQuery.data.majorMinorTrack.minorSubject
                ? ` · Minor: ${trackContextQuery.data.majorMinorTrack.minorSubject.name}`
                : ''}
            </p>
          ) : null}
          {trackContextQuery.data.vtcTrack?.trackGroupCode ? (
            <p className="mt-1 text-xs text-muted-foreground">
              VTC track: {trackContextQuery.data.vtcTrack.trackGroupCode}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">Registration summary</p>
            <p className="text-xs text-muted-foreground">
              Semester {profile.semester}
              {currentRegistration ? ` · ${currentRegistration.status}` : ' · no registration yet'}
              {creditTotal > 0 ? ` · ${creditTotal} credits in view` : ''}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={autoAssignMut.isPending}
            onClick={() => autoAssignMut.mutate()}
          >
            {autoAssignMut.isPending ? 'Assigning…' : 'Auto-assign compulsory'}
          </Button>
        </div>
        {actionMessage ? (
          <p className="mt-2 text-xs text-muted-foreground">{actionMessage}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Registered subjects</p>
          <p className="text-xs text-muted-foreground">
            {enrollmentSource.length} line(s)
            {creditTotal > 0 ? ` · ${creditTotal} credits in view` : ''}
            {registrationsQuery.isLoading ? ' · loading…' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/students/subject-registration?student=${profile.id}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Open registration admin
          </Link>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            Import Excel
          </Button>
        </div>
      </div>

      {Object.keys(nepGroups).length > 0 ? (
        <div className="rounded-md border border-border p-3">
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
            NEP category coverage
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(nepGroups).map(([cat, courses]) => {
              const normalizedCategory = normalizeCategory(cat);
              const enrolled = enrollmentSource.filter(
                (r) =>
                  normalizeCategory(isApiRow(r) ? r.category : r.category) === normalizedCategory,
              );
              return (
                <div key={cat} className="rounded border border-border/60 px-2 py-1.5 text-xs">
                  <span className="font-semibold">{normalizedCategory}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {enrolled.length}/{courses.length || 1} filled
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={semTab === 'all' ? 'default' : 'outline'}
          onClick={() => setSemTab('all')}
        >
          All semesters
        </Button>
        {semIds.map((sem) => (
          <Button
            key={sem}
            type="button"
            size="sm"
            variant={semTab === sem ? 'default' : 'outline'}
            onClick={() => setSemTab(sem)}
          >
            Sem {sem}
          </Button>
        ))}
      </div>

      {semTab === 'all' && semIds.length > 1 ? (
        <div className="space-y-4">
          {semIds.map((sem) => (
            <div key={sem}>
              <h3 className="mb-2 text-sm font-semibold">Semester {sem}</h3>
              <CategorizedRegistration
                rows={bySemester.get(sem) ?? []}
                majorName={
                  trackContextQuery.data?.majorMinorTrack?.majorSubject?.name ??
                  profile.programChoices?.find((c) => c.choiceType === 'MAJOR')?.subjectName
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <CategorizedRegistration
          rows={rows}
          majorName={
            trackContextQuery.data?.majorMinorTrack?.majorSubject?.name ??
            profile.programChoices?.find((c) => c.choiceType === 'MAJOR')?.subjectName
          }
        />
      )}

      {semId ? (
        <RegistrationImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          semesterId={semId}
          semesterSequence={profile.semester}
        />
      ) : null}
    </div>
  );
}

function departmentFromCourseCode(code?: string | null) {
  const prefix = String(code ?? '')
    .split(/[-:]/)[0]
    ?.trim()
    .toUpperCase();
  const map: Record<string, string> = {
    ECO: 'Economics',
    EDU: 'Education',
    ENG: 'English',
    GAR: 'Garo',
    GEO: 'Geography',
    HIS: 'History',
    PHI: 'Philosophy',
    POL: 'Political Science',
    SOC: 'Sociology',
    COM: 'Commerce',
    BCOM: 'Commerce',
    ACC: 'Commerce',
  };
  return prefix ? map[prefix] : undefined;
}

function rowCourse(row: TableRow) {
  if (isApiRow(row)) {
    return { code: row.course.code, title: row.course.title, category: row.category };
  }
  return { code: row.courseCode, title: row.courseTitle, category: row.category };
}

function CategorizedRegistration({
  rows,
  majorName,
}: {
  rows: TableRow[];
  majorName?: string | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-border py-6 text-center text-sm text-muted-foreground">
        No registrations for this semester.
      </p>
    );
  }

  const majorPapers = rows.filter((row) => normalizeCategory(rowCourse(row).category) === 'MAJOR');
  const majorDepartment =
    majorName ?? departmentFromCourseCode(rowCourse(majorPapers[0] ?? rows[0]).code) ?? '—';
  const categories = ['MINOR', 'MDC', 'AEC', 'SEC', 'VAC', 'VTC', 'INTERNSHIP'] as const;

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Major Department
        </p>
        <p className="text-sm font-medium">{majorDepartment}</p>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Major Papers
        </p>
        <ul className="mt-1 space-y-1 text-sm">
          {majorPapers.length ? (
            majorPapers.map((row, index) => {
              const course = rowCourse(row);
              return (
                <li key={`${course.code}-${index}`}>
                  • <span className="font-mono text-xs text-muted-foreground">{course.code}</span>
                  {' — '}
                  {formatCourseDisplayTitle(course.title)}
                </li>
              );
            })
          ) : (
            <li className="text-muted-foreground">—</li>
          )}
        </ul>
      </div>
      {categories.map((category) => {
        const items = rows.filter((row) => normalizeCategory(rowCourse(row).category) === category);
        if (!items.length) return null;
        return (
          <div key={category}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {category}
            </p>
            <ul className="mt-1 space-y-1 text-sm">
              {items.map((row, index) => {
                const course = rowCourse(row);
                return (
                  <li key={`${category}-${course.code}-${index}`}>
                    • {formatCourseDisplayTitle(course.title)}
                    <span className="ml-1 font-mono text-xs text-muted-foreground">
                      ({course.code})
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
