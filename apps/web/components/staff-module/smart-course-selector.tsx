'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, Search, X } from 'lucide-react';

import { NEP_CURRICULUM_CATEGORIES } from '@/constants/nep-curriculum-categories';
import { fetchAcademicDepartments } from '@/services/organization';
import { fetchAllPrograms, fetchCourses } from '@/services/programs';
import type { Course, CourseListParams, Program } from '@/types/programs';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const SEMESTER_LABELS: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
  8: 'VIII',
};
const CATEGORY_OPTIONS = NEP_CURRICULUM_CATEGORIES.filter((c) =>
  [
    'MAJOR',
    'MINOR',
    'MDC',
    'AEC',
    'SEC',
    'VAC',
    'VTC',
    'ELECTIVE',
    'INTERNSHIP',
    'RESEARCH',
  ].includes(c),
);
const RECENT_LIMIT = 6;

type ProgrammeOption = {
  id: string;
  label: string;
  departmentId?: string | null;
  level?: string | null;
};

export type SmartCoursePickerSelection = {
  courseId: string;
  courseLabel: string;
  semesterNo: number;
  category?: string | null;
  course: Course;
};

type Props = {
  defaultDepartmentId?: string | null;
  assignedCourseIds?: string[];
  disabled?: boolean;
  recentStorageKey: string;
  confirmLabel?: string;
  onConfirm: (selections: SmartCoursePickerSelection[]) => void | Promise<void>;
};

function formatCredits(credits: Course['credits']) {
  const n = Number(credits);
  if (!Number.isFinite(n)) return null;
  return n === 1 ? '1 Credit' : `${n} Credits`;
}

function courseTitle(course: Course) {
  return `${course.code} - ${course.title}`;
}

function courseLabel(course: Course) {
  return `${course.code} — ${course.title}`;
}

function currentProgramVersion(program: Program) {
  return program.versions.find((v) => v.status === 'PUBLISHED') ?? program.versions[0];
}

function toProgrammeOptions(programs: Program[]): ProgrammeOption[] {
  return programs.flatMap((program) => {
    const version = currentProgramVersion(program);
    if (!version) return [];
    return [
      {
        id: version.id,
        label: `${program.code} - ${program.name}`,
        departmentId: program.departmentId ?? null,
        level: program.level ?? null,
      },
    ];
  });
}

function selectedSemesterFor(course: Course, semesterFilter: number | '') {
  if (semesterFilter) return semesterFilter;
  const mapped = course.mappingSummary?.find((m) => m.semesterSequence != null);
  return mapped?.semesterSequence ?? 1;
}

function selectedCategoryFor(course: Course, category: string) {
  if (category) return category;
  return course.mappingSummary?.find((m) => m.category)?.category ?? null;
}

function bestMapping(course: Course, filters: { semester: number | ''; category: string }) {
  const mappings = course.mappingSummary ?? [];
  return (
    mappings.find(
      (m) =>
        (!filters.semester || m.semesterSequence === filters.semester) &&
        (!filters.category || m.category === filters.category),
    ) ??
    mappings.find((m) => !filters.semester || m.semesterSequence === filters.semester) ??
    mappings.find((m) => !filters.category || m.category === filters.category) ??
    mappings[0]
  );
}

function courseMeta(course: Course, filters: { semester: number | ''; category: string }) {
  const mapping = bestMapping(course, filters);
  const bits = [
    mapping?.programCode ?? course.department?.name ?? 'Shared Pool',
    mapping?.semesterSequence ? `Semester ${mapping.semesterSequence}` : null,
    mapping?.category ?? course.courseType,
    formatCredits(course.credits),
  ].filter(Boolean);
  return bits.join(' • ');
}

function readRecentCourses(key: string): Course[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecentCourses(key: string, courses: Course[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(courses.slice(0, RECENT_LIMIT)));
}

export function SmartCourseSelector({
  defaultDepartmentId,
  assignedCourseIds = [],
  disabled,
  recentStorageKey,
  confirmLabel = 'Assign Selected',
  onConfirm,
}: Props) {
  const [departmentId, setDepartmentId] = useState(defaultDepartmentId ?? '');
  const [programVersionId, setProgramVersionId] = useState('');
  const [semester, setSemester] = useState<number | ''>('');
  const [category, setCategory] = useState('');
  const [deliveryType, setDeliveryType] = useState<CourseListParams['deliveryType']>();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, Course>>({});
  const [recent, setRecent] = useState<Course[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);
  const assignedSet = useMemo(() => new Set(assignedCourseIds), [assignedCourseIds]);

  useEffect(() => {
    setRecent(readRecentCourses(recentStorageKey));
  }, [recentStorageKey]);

  useEffect(() => {
    if (!departmentId && defaultDepartmentId) setDepartmentId(defaultDepartmentId);
  }, [defaultDepartmentId, departmentId]);

  const departments = useQuery({
    queryKey: ['staff-smart-course-picker', 'departments'],
    queryFn: () => fetchAcademicDepartments(),
  });

  const programs = useQuery({
    queryKey: ['staff-smart-course-picker', 'programs'],
    queryFn: () => fetchAllPrograms(),
  });

  const programmeOptions = useMemo(() => {
    const options = toProgrammeOptions(programs.data?.data ?? []);
    return departmentId ? options.filter((p) => p.departmentId === departmentId) : options;
  }, [departmentId, programs.data]);

  useEffect(() => {
    if (programVersionId && !programmeOptions.some((p) => p.id === programVersionId)) {
      setProgramVersionId('');
    }
  }, [programmeOptions, programVersionId]);

  const courses = useQuery({
    queryKey: [
      'staff-smart-course-picker',
      'courses',
      debouncedSearch,
      departmentId,
      programVersionId,
      semester,
      category,
      deliveryType,
    ],
    queryFn: () =>
      fetchCourses({
        page: 1,
        limit: 20,
        search: debouncedSearch,
        departmentId,
        programVersionId,
        semesterSequence: semester || undefined,
        category,
        deliveryType,
      }),
  });

  const selectedCourses = useMemo(() => Object.values(selected), [selected]);

  const toggleCourse = (course: Course) => {
    if (disabled || assignedSet.has(course.id)) return;
    setSelected((current) => {
      const next = { ...current };
      if (next[course.id]) {
        delete next[course.id];
      } else {
        next[course.id] = course;
      }
      return next;
    });
  };

  const applySelection = async () => {
    if (!selectedCourses.length) return;
    const payload = selectedCourses.map((course) => ({
      courseId: course.id,
      courseLabel: courseLabel(course),
      semesterNo: selectedSemesterFor(course, semester),
      category: selectedCategoryFor(course, category),
      course,
    }));
    setSubmitting(true);
    try {
      await onConfirm(payload);
      const nextRecent = [
        ...selectedCourses,
        ...recent.filter((course) => !selected[course.id]),
      ].slice(0, RECENT_LIMIT);
      setRecent(nextRecent);
      writeRecentCourses(recentStorageKey, nextRecent);
      setSelected({});
    } finally {
      setSubmitting(false);
    }
  };

  const setMyDepartment = () => {
    if (defaultDepartmentId) setDepartmentId(defaultDepartmentId);
  };

  const setQuickCategory = (next: string) => {
    setCategory((current) => (current === next ? '' : next));
  };

  const rows = courses.data?.data ?? [];
  const loading = courses.isFetching;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        <label className="space-y-1 text-[11px]">
          <span className="font-medium text-muted-foreground">Department</span>
          <select
            className="glass-card h-9 w-full rounded-lg border border-border/60 bg-background/70 px-2 text-xs"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            disabled={disabled || departments.isLoading}
          >
            <option value="">All Departments</option>
            {(departments.data ?? []).map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-[11px]">
          <span className="font-medium text-muted-foreground">Programme</span>
          <select
            className="glass-card h-9 w-full rounded-lg border border-border/60 bg-background/70 px-2 text-xs"
            value={programVersionId}
            onChange={(e) => setProgramVersionId(e.target.value)}
            disabled={disabled || programs.isLoading}
          >
            <option value="">All Programmes</option>
            {programmeOptions.map((program) => (
              <option key={program.id} value={program.id}>
                {program.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-[11px]">
          <span className="font-medium text-muted-foreground">Semester</span>
          <select
            className="glass-card h-9 w-full rounded-lg border border-border/60 bg-background/70 px-2 text-xs"
            value={semester}
            onChange={(e) => setSemester(e.target.value ? Number(e.target.value) : '')}
            disabled={disabled}
          >
            <option value="">All Semesters</option>
            {SEMESTERS.map((sem) => (
              <option key={sem} value={sem}>
                Semester {sem}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-[11px]">
          <span className="font-medium text-muted-foreground">Category</span>
          <select
            className="glass-card h-9 w-full rounded-lg border border-border/60 bg-background/70 px-2 text-xs"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={disabled}
          >
            <option value="">All Categories</option>
            {CATEGORY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-medium text-muted-foreground">Semester</span>
        <FilterChip active={semester === ''} onClick={() => setSemester('')}>
          ALL
        </FilterChip>
        {SEMESTERS.map((sem) => (
          <FilterChip key={sem} active={semester === sem} onClick={() => setSemester(sem)}>
            {SEMESTER_LABELS[sem]}
          </FilterChip>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={Boolean(defaultDepartmentId && departmentId === defaultDepartmentId)}
          disabled={!defaultDepartmentId}
          onClick={setMyDepartment}
        >
          My Department
        </FilterChip>
        <FilterChip active={category === 'MAJOR'} onClick={() => setQuickCategory('MAJOR')}>
          Major
        </FilterChip>
        <FilterChip active={category === 'MINOR'} onClick={() => setQuickCategory('MINOR')}>
          Minor
        </FilterChip>
        <FilterChip disabled title="Shared pool source is not exposed in course search yet">
          Shared Courses
        </FilterChip>
        <FilterChip disabled title="Teaching history suggestions need assignment analytics">
          Teaching Courses
        </FilterChip>
        <FilterChip disabled title="Select a programme to narrow UG courses">
          UG
        </FilterChip>
        <FilterChip disabled title="Select a programme to narrow PG courses">
          PG
        </FilterChip>
        <FilterChip
          active={deliveryType === 'PRACTICAL'}
          onClick={() => setDeliveryType((v) => (v === 'PRACTICAL' ? undefined : 'PRACTICAL'))}
        >
          Labs
        </FilterChip>
        <FilterChip
          active={deliveryType === 'THEORY'}
          onClick={() => setDeliveryType((v) => (v === 'THEORY' ? undefined : 'THEORY'))}
        >
          Theory
        </FilterChip>
      </div>

      <div className="glass-card flex h-10 items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search course, code, department, programme..."
          disabled={disabled}
        />
        {search ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setSearch('')}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
      </div>

      {recent.length ? (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground">Recent Courses</p>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((course) => (
              <button
                key={course.id}
                type="button"
                className="rounded-full border border-border/60 bg-muted/40 px-2 py-1 text-[11px] hover:bg-muted"
                onClick={() => toggleCourse(course)}
                disabled={disabled || assignedSet.has(course.id)}
              >
                {course.code}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="max-h-80 overflow-y-auto rounded-xl border border-border/60">
        {rows.length === 0 && !loading ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">No matching courses found.</p>
        ) : (
          rows.map((course) => {
            const checked = Boolean(selected[course.id]);
            const alreadyAssigned = assignedSet.has(course.id);
            return (
              <button
                key={course.id}
                type="button"
                className={cn(
                  'flex w-full items-start gap-3 border-b border-border/50 px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/40',
                  checked && 'bg-primary/5',
                  alreadyAssigned && 'cursor-not-allowed opacity-60',
                )}
                onClick={() => toggleCourse(course)}
                disabled={disabled || alreadyAssigned}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border',
                    checked && 'border-primary bg-primary text-primary-foreground',
                  )}
                >
                  {checked ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {courseTitle(course)}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {courseMeta(course, { semester, category })}
                  </span>
                </span>
                {alreadyAssigned ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    Assigned
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {selectedCourses.length
            ? `${selectedCourses.length} selected`
            : 'Select one or more courses to assign.'}
        </p>
        <Button
          type="button"
          size="sm"
          className="h-8 text-xs"
          disabled={disabled || submitting || selectedCourses.length === 0}
          onClick={() => void applySelection()}
        >
          {submitting ? 'Assigning...' : confirmLabel}
        </Button>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'bg-background/70 hover:bg-muted',
        disabled && 'cursor-not-allowed opacity-45 hover:bg-background/70',
      )}
    >
      {children}
    </button>
  );
}
