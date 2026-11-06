'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Database,
  ExternalLink,
  FileSpreadsheet,
  Layers,
  Leaf,
  Library,
  RefreshCw,
  Share2,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

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

type TableRow = EnrollmentRow | StudentSemesterRegistrationRow;

const CORE_CATEGORIES = ['MAJOR', 'MINOR', 'MDC', 'AEC', 'SEC', 'VAC'] as const;
const EXTRA_CATEGORIES = ['VTC', 'INTERNSHIP'] as const;

const CATEGORY_STYLE: Record<
  string,
  { card: string; iconWrap: string; pill: string; icon: LucideIcon }
> = {
  MAJOR: {
    card: 'border-sky-100 bg-sky-50',
    iconWrap: 'bg-sky-100 text-sky-600',
    pill: 'bg-sky-100 text-sky-700',
    icon: Database,
  },
  MINOR: {
    card: 'border-cyan-100 bg-cyan-50',
    iconWrap: 'bg-cyan-100 text-cyan-600',
    pill: 'bg-cyan-100 text-cyan-700',
    icon: Share2,
  },
  MDC: {
    card: 'border-amber-100 bg-amber-50',
    iconWrap: 'bg-amber-100 text-amber-600',
    pill: 'bg-amber-100 text-amber-700',
    icon: Layers,
  },
  AEC: {
    card: 'border-emerald-100 bg-emerald-50',
    iconWrap: 'bg-emerald-100 text-emerald-600',
    pill: 'bg-emerald-100 text-emerald-700',
    icon: Sparkles,
  },
  SEC: {
    card: 'border-rose-100 bg-rose-50',
    iconWrap: 'bg-rose-100 text-rose-600',
    pill: 'bg-rose-100 text-rose-700',
    icon: ClipboardList,
  },
  VAC: {
    card: 'border-violet-100 bg-violet-50',
    iconWrap: 'bg-violet-100 text-violet-600',
    pill: 'bg-violet-100 text-violet-700',
    icon: Leaf,
  },
  VTC: {
    card: 'border-teal-100 bg-teal-50',
    iconWrap: 'bg-teal-100 text-teal-600',
    pill: 'bg-teal-100 text-teal-700',
    icon: Library,
  },
  INTERNSHIP: {
    card: 'border-slate-200 bg-slate-50',
    iconWrap: 'bg-slate-100 text-slate-600',
    pill: 'bg-slate-100 text-slate-700',
    icon: BookOpen,
  },
};

function normalizeCategory(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

function isApiRow(row: TableRow): row is StudentSemesterRegistrationRow {
  return 'course' in row && typeof row.course === 'object';
}

function rowCourse(row: TableRow) {
  if (isApiRow(row)) {
    return { code: row.course.code, title: row.course.title, category: row.category };
  }
  return { code: row.courseCode, title: row.courseTitle, category: row.category };
}

function rowCredits(row: TableRow) {
  if (isApiRow(row)) return row.course.credits ?? 0;
  return row.credits ?? 0;
}

function rowStatus(row: TableRow) {
  return isApiRow(row) ? row.lineStatus : row.status;
}

function rowType(row: TableRow) {
  const course = rowCourse(row);
  const text = `${course.code ?? ''} ${course.title ?? ''}`;
  if (/pract|laboratory|\blab\b/i.test(text)) return 'Practical';
  if (/tutorial/i.test(text)) return 'Tutorial';
  return 'Theory';
}

function statusLabel(status?: string | null) {
  const value = String(status ?? '').toLowerCase();
  if (!value) return 'Registered';
  if (['registered', 'active', 'enrolled', 'confirmed', 'completed', 'approved'].includes(value)) {
    return 'Registered';
  }
  if (value === 'draft' || value === 'pending') return 'Pending';
  return status ?? 'Registered';
}

function progressLabel(status?: string | null) {
  const value = String(status ?? '').toLowerCase();
  if (!value || value === 'none') return 'Not started';
  if (['completed', 'approved', 'confirmed'].includes(value)) return 'Completed';
  return 'In Progress';
}

function expectedSemesters(profile: StudentProfile, highest: number) {
  const name = `${profile.programme ?? ''} ${profile.programmeCode ?? ''}`.toUpperCase();
  const base = /\b(MA|MSC|MCOM|PG)\b/.test(name) ? 4 : 6;
  return Math.max(base, profile.semester || 1, highest);
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
    BOT: 'Botany',
    CHE: 'Chemistry',
    MAT: 'Mathematics',
    PHY: 'Physics',
    ZOO: 'Zoology',
  };
  return prefix ? map[prefix] : undefined;
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
      const sem = row.semesterSequence;
      if (sem) set.add(sem);
    }
    return [...set].sort((a, b) => a - b);
  }, [enrollmentSource]);

  const rows = useMemo(() => {
    if (semTab === 'all') return enrollmentSource;
    return enrollmentSource.filter((row) => row.semesterSequence === semTab);
  }, [enrollmentSource, semTab]);

  const bySemester = useMemo(() => {
    const map = new Map<number, TableRow[]>();
    for (const row of enrollmentSource) {
      const sem = row.semesterSequence ?? 0;
      if (!map.has(sem)) map.set(sem, []);
      map.get(sem)!.push(row);
    }
    return map;
  }, [enrollmentSource]);

  const nepGroups = profile.nepCategoryGroups ?? {};
  const semId = (profile.registrations as { semesterId?: string }[])?.[0]?.semesterId ?? '';

  const creditTotal = useMemo(() => rows.reduce((sum, row) => sum + rowCredits(row), 0), [rows]);

  const currentRegistration = useMemo(() => {
    const registrations = profile.registrations as RegistrationSummary[];
    return (
      registrations.find((item) => item.semesterSequence === profile.semester) ??
      registrations[0] ??
      null
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
    onError: (error) => setActionMessage(apiErrorMessage(error, 'Auto-assign failed')),
  });

  const coverage = useMemo(() => {
    const categories = [
      ...CORE_CATEGORIES,
      ...EXTRA_CATEGORIES.filter((category) => {
        const key = category.toLowerCase() as keyof typeof nepGroups;
        const expected = nepGroups[key]?.length ?? 0;
        const filled = rows.some((row) => normalizeCategory(rowCourse(row).category) === category);
        return expected > 0 || filled;
      }),
    ];
    return categories.map((category) => {
      const enrolled = rows.filter(
        (row) => normalizeCategory(rowCourse(row).category) === category,
      );
      return {
        category,
        count: enrolled.length,
        credits: enrolled.reduce((sum, row) => sum + rowCredits(row), 0),
      };
    });
  }, [nepGroups, rows]);

  const majorName =
    trackContextQuery.data?.majorMinorTrack?.majorSubject?.name ??
    profile.programChoices?.find((choice) => choice.choiceType === 'MAJOR')?.subjectName ??
    profile.departmentName;
  const majorRow =
    rows.find((row) => normalizeCategory(rowCourse(row).category) === 'MAJOR') ?? rows[0];
  const department =
    majorName || departmentFromCourseCode(majorRow ? rowCourse(majorRow).code : '') || '—';
  const semesterTotal = expectedSemesters(profile, semIds[semIds.length - 1] ?? 0);
  const semesterButtons = Array.from({ length: semesterTotal }, (_, index) => index + 1);
  const progress = progressLabel(currentRegistration?.status);
  const tableGroups =
    semTab === 'all' && semIds.length > 1
      ? semIds.map((sem) => ({ sem, rows: bySemester.get(sem) ?? [] }))
      : [
          {
            sem: semTab === 'all' ? (semIds[0] ?? profile.semester) : semTab,
            rows,
          },
        ];
  const trackSummary = [
    trackContextQuery.data?.majorMinorTrack?.isTrackLocked
      ? `Major/Minor track locked${
          trackContextQuery.data.majorMinorTrack.majorSubject
            ? ` · Major: ${trackContextQuery.data.majorMinorTrack.majorSubject.name}`
            : ''
        }${
          trackContextQuery.data.majorMinorTrack.minorSubject
            ? ` · Minor: ${trackContextQuery.data.majorMinorTrack.minorSubject.name}`
            : ''
        }`
      : '',
    trackContextQuery.data?.vtcTrack?.trackGroupCode
      ? `VTC track: ${trackContextQuery.data.vtcTrack.trackGroupCode}`
      : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
          <Layers className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Registered Subjects
          </h2>
          <p className="text-sm text-slate-500">
            Semester-wise subject registration details and NEP category coverage.
          </p>
        </div>
      </div>

      {trackSummary ? <p className="mt-3 text-xs text-slate-500">{trackSummary}</p> : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-50">Registration Summary</p>
            <p className="text-xs text-slate-500">
              Total subjects registered and completion status
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <SummaryStat
            icon={CheckCircle2}
            iconClass="bg-emerald-100 text-emerald-600"
            value={String(rows.length)}
            label="Registered Subjects"
          />
          <SummaryStat
            icon={BookOpen}
            iconClass="bg-sky-100 text-sky-600"
            value={String(creditTotal)}
            label="Total Credits"
          />
          <SummaryStat
            icon={CalendarDays}
            iconClass="bg-violet-100 text-violet-600"
            value={`${semIds.length} / ${semesterTotal}`}
            label="Semesters Completed"
          />
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> {progress}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-50">NEP Category Coverage</p>
          <p className="text-xs text-slate-500">
            Subject registration count under each NEP category.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9"
            disabled={autoAssignMut.isPending}
            onClick={() => autoAssignMut.mutate()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {autoAssignMut.isPending ? 'Assigning…' : 'Auto-assign Compulsory'}
          </Button>
          <Link
            href={`/admin/students/subject-registration?student=${profile.id}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-9')}
          >
            <ExternalLink className="mr-2 h-4 w-4" /> Open Registration Admin
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            onClick={() => setImportOpen(true)}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Import from Excel
          </Button>
        </div>
      </div>
      {actionMessage ? <p className="mt-2 text-xs text-slate-500">{actionMessage}</p> : null}
      {registrationsQuery.isLoading ? (
        <p className="mt-2 text-xs text-slate-400">Loading registrations…</p>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {coverage.map((item) => {
          const style = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE.INTERNSHIP;
          const Icon = style.icon;
          return (
            <div
              key={item.category}
              className={cn(
                'flex items-center justify-between rounded-2xl border px-4 py-3',
                style.card,
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl',
                    style.iconWrap,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.category}</p>
                  <p className="text-xs text-slate-500">
                    {item.count} {item.count === 1 ? 'Subject' : 'Subjects'}
                  </p>
                </div>
              </div>
              <p className="inline-flex items-center gap-1 text-sm font-medium text-slate-600">
                {item.count > 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : null}
                {item.credits} Credits
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSemTab('all')}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium',
            semTab === 'all'
              ? 'bg-[#2563eb] text-white'
              : 'border border-slate-200 bg-white text-slate-600',
          )}
        >
          All Semesters
        </button>
        {semesterButtons.map((sem) => (
          <button
            key={sem}
            type="button"
            onClick={() => setSemTab(sem)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium',
              semTab === sem
                ? 'bg-[#2563eb] text-white'
                : 'border border-slate-200 bg-white text-slate-600',
            )}
          >
            Sem {sem}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {tableGroups.map((group) => (
          <SubjectTable
            key={group.sem}
            semester={group.sem}
            rows={group.rows}
            department={department}
          />
        ))}
      </div>

      {semId ? (
        <RegistrationImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          semesterId={semId}
          semesterSequence={profile.semester}
        />
      ) : null}
    </section>
  );
}

function SummaryStat({
  icon: Icon,
  iconClass,
  value,
  label,
}: {
  icon: LucideIcon;
  iconClass: string;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-full', iconClass)}>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-base font-semibold leading-none text-slate-900 dark:text-slate-50">
          {value}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function SubjectTable({
  semester,
  rows,
  department,
}: {
  semester: number;
  rows: TableRow[];
  department: string;
}) {
  const credits = rows.reduce((sum, row) => sum + rowCredits(row), 0);
  const ordered = [...rows].sort((left, right) => {
    const order = [...CORE_CATEGORIES, ...EXTRA_CATEGORIES];
    const leftIndex = order.indexOf(
      normalizeCategory(rowCourse(left).category) as (typeof order)[number],
    );
    const rightIndex = order.indexOf(
      normalizeCategory(rowCourse(right).category) as (typeof order)[number],
    );
    return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-sky-50/80 px-4 py-3">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <BookOpen className="h-4 w-4 text-sky-600" />
          Registered Subjects – Semester {semester}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span>
            Department: <span className="font-medium text-slate-800">{department}</span>
          </span>
          <span className="hidden h-4 w-px bg-slate-200 sm:block" />
          <span>
            Total Subjects: <span className="font-medium text-slate-800">{rows.length}</span>
          </span>
          <span className="hidden h-4 w-px bg-slate-200 sm:block" />
          <span>
            Total Credits: <span className="font-medium text-slate-800">{credits}</span>
          </span>
        </div>
      </div>
      {ordered.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          No registrations for this semester.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-sky-100 bg-sky-50/50 text-left text-slate-500">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Subject Code</th>
                <th className="px-4 py-3 font-medium">Subject Name</th>
                <th className="px-4 py-3 font-medium">NEP Category</th>
                <th className="px-4 py-3 font-medium">Credits</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((row, index) => {
                const course = rowCourse(row);
                const category = normalizeCategory(course.category) || '—';
                const style = CATEGORY_STYLE[category] ?? CATEGORY_STYLE.INTERNSHIP;
                const registered = statusLabel(rowStatus(row)) === 'Registered';
                return (
                  <tr
                    key={`${course.code}-${index}`}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', style.pill)}
                      >
                        {course.code || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {formatCourseDisplayTitle(course.title)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', style.pill)}
                      >
                        {category === 'MAJOR' ? 'Major' : category === 'MINOR' ? 'Minor' : category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{rowCredits(row)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
                        {rowType(row)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-sm font-medium',
                          registered ? 'text-emerald-600' : 'text-amber-600',
                        )}
                      >
                        {registered ? <CheckCircle2 className="h-4 w-4" /> : null}
                        {statusLabel(rowStatus(row))}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
