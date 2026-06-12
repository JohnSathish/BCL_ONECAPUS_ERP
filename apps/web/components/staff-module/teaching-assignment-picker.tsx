'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, Search, X } from 'lucide-react';

import { NEP_CURRICULUM_CATEGORIES } from '@/constants/nep-curriculum-categories';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { fetchAcademicDepartments } from '@/services/organization';
import { fetchAllPrograms } from '@/services/programs';
import { fetchShifts } from '@/services/shifts';
import { fetchAssignableTeachingContexts, fetchTeachingAssignmentContexts } from '@/services/staff';
import type { Program } from '@/types/programs';
import type { TeachingAssignmentContext } from '@/types/staff';
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
};

type Props = {
  staffId?: string;
  defaultDepartmentId?: string | null;
  assignedContextIds?: string[];
  disabled?: boolean;
  recentStorageKey: string;
  confirmLabel?: string;
  onConfirm: (contexts: TeachingAssignmentContext[]) => void | Promise<void>;
};

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
      },
    ];
  });
}

function readRecent(key: string): TeachingAssignmentContext[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecent(key: string, rows: TeachingAssignmentContext[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(rows.slice(0, RECENT_LIMIT)));
}

function contextTitle(row: TeachingAssignmentContext) {
  return `${row.course.code} - ${row.course.title}`;
}

function contextMeta(row: TeachingAssignmentContext) {
  return [
    `${row.programVersion.program.code} v${row.programVersion.version}`,
    `Semester ${row.semesterNo}`,
    row.category,
    `Section ${row.sectionCode}`,
    row.shift?.name ?? row.shift?.code,
    row.streamScope.length ? row.streamScope.map((s) => s.code).join(', ') : null,
  ]
    .filter(Boolean)
    .join(' • ');
}

function roleLabel(role: string) {
  return role
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function TeachingAssignmentPicker({
  staffId,
  defaultDepartmentId,
  assignedContextIds = [],
  disabled,
  recentStorageKey,
  confirmLabel = 'Assign Selected',
  onConfirm,
}: Props) {
  const [departmentId, setDepartmentId] = useState(defaultDepartmentId ?? '');
  const [programVersionId, setProgramVersionId] = useState('');
  const [semesterNo, setSemesterNo] = useState<number | ''>('');
  const [category, setCategory] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [sectionCode, setSectionCode] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, TeachingAssignmentContext>>({});
  const [recent, setRecent] = useState<TeachingAssignmentContext[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);
  const assignedSet = useMemo(() => new Set(assignedContextIds), [assignedContextIds]);

  useEffect(() => {
    setRecent(readRecent(recentStorageKey));
  }, [recentStorageKey]);

  useEffect(() => {
    if (!departmentId && defaultDepartmentId) setDepartmentId(defaultDepartmentId);
  }, [defaultDepartmentId, departmentId]);

  const departments = useQuery({
    queryKey: ['teaching-context-picker', 'departments'],
    queryFn: () => fetchAcademicDepartments(),
  });
  const programs = useQuery({
    queryKey: ['teaching-context-picker', 'programs'],
    queryFn: () => fetchAllPrograms(),
  });
  const shifts = useQuery({
    queryKey: ['teaching-context-picker', 'shifts'],
    queryFn: () => fetchShifts({ status: 'ACTIVE' }),
  });

  const programmeOptions = useMemo(() => {
    const options = toProgrammeOptions(programs.data?.data ?? []);
    return departmentId ? options.filter((p) => p.departmentId === departmentId) : options;
  }, [departmentId, programs.data]);

  useEffect(() => {
    if (programVersionId && !programmeOptions.some((p) => p.id === programVersionId)) {
      setProgramVersionId('');
    }
  }, [programVersionId, programmeOptions]);

  const contexts = useQuery({
    queryKey: [
      'teaching-context-picker',
      staffId ?? 'new',
      debouncedSearch,
      departmentId,
      programVersionId,
      semesterNo,
      category,
      shiftId,
      sectionCode,
    ],
    queryFn: () => {
      const params = {
        page: 1,
        limit: 30,
        search: debouncedSearch || undefined,
        departmentId: departmentId || undefined,
        programVersionId: programVersionId || undefined,
        semesterNo: semesterNo || undefined,
        category: category || undefined,
        shiftId: shiftId || undefined,
        sectionCode: sectionCode || undefined,
      };
      return staffId
        ? fetchTeachingAssignmentContexts(staffId, params)
        : fetchAssignableTeachingContexts(params);
    },
  });

  const selectedRows = useMemo(() => Object.values(selected), [selected]);

  const toggle = (row: TeachingAssignmentContext) => {
    if (disabled || assignedSet.has(row.offeringSectionId)) return;
    setSelected((current) => {
      const next = { ...current };
      if (next[row.offeringSectionId]) delete next[row.offeringSectionId];
      else next[row.offeringSectionId] = row;
      return next;
    });
  };

  const apply = async () => {
    if (!selectedRows.length) return;
    setSubmitting(true);
    try {
      await onConfirm(selectedRows);
      const nextRecent = [
        ...selectedRows,
        ...recent.filter((row) => !selected[row.offeringSectionId]),
      ].slice(0, RECENT_LIMIT);
      setRecent(nextRecent);
      writeRecent(recentStorageKey, nextRecent);
      setSelected({});
    } finally {
      setSubmitting(false);
    }
  };

  const rows = contexts.data?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <SelectFilter
          label="Department"
          value={departmentId}
          onChange={setDepartmentId}
          disabled={disabled || departments.isLoading}
        >
          <option value="">All Departments</option>
          {(departments.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </SelectFilter>
        <SelectFilter
          label="Programme"
          value={programVersionId}
          onChange={setProgramVersionId}
          disabled={disabled || programs.isLoading}
        >
          <option value="">All Programmes</option>
          {programmeOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </SelectFilter>
        <SelectFilter
          label="Semester"
          value={semesterNo}
          onChange={(v) => setSemesterNo(v ? Number(v) : '')}
          disabled={disabled}
        >
          <option value="">All</option>
          {SEMESTERS.map((sem) => (
            <option key={sem} value={sem}>
              Semester {sem}
            </option>
          ))}
        </SelectFilter>
        <SelectFilter label="Category" value={category} onChange={setCategory} disabled={disabled}>
          <option value="">All Categories</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectFilter>
        <SelectFilter
          label="Shift"
          value={shiftId}
          onChange={setShiftId}
          disabled={disabled || shifts.isLoading}
        >
          <option value="">All Shifts</option>
          {(shifts.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectFilter>
        <label className="space-y-1 text-[11px]">
          <span className="font-medium text-muted-foreground">Section</span>
          <input
            className="glass-card h-9 w-full rounded-lg border border-border/60 bg-background/70 px-2 text-xs"
            value={sectionCode}
            onChange={(e) => setSectionCode(e.target.value)}
            placeholder="A / B / Lab"
            disabled={disabled}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-medium text-muted-foreground">Semester</span>
        <FilterChip active={semesterNo === ''} onClick={() => setSemesterNo('')}>
          ALL
        </FilterChip>
        {SEMESTERS.map((sem) => (
          <FilterChip key={sem} active={semesterNo === sem} onClick={() => setSemesterNo(sem)}>
            {SEMESTER_LABELS[sem]}
          </FilterChip>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={Boolean(defaultDepartmentId && departmentId === defaultDepartmentId)}
          disabled={!defaultDepartmentId}
          onClick={() => defaultDepartmentId && setDepartmentId(defaultDepartmentId)}
        >
          My Department
        </FilterChip>
        <FilterChip
          active={category === 'MAJOR'}
          onClick={() => setCategory(category === 'MAJOR' ? '' : 'MAJOR')}
        >
          Major
        </FilterChip>
        <FilterChip
          active={category === 'MINOR'}
          onClick={() => setCategory(category === 'MINOR' ? '' : 'MINOR')}
        >
          Minor
        </FilterChip>
        <FilterChip
          active={category === 'AEC'}
          onClick={() => setCategory(category === 'AEC' ? '' : 'AEC')}
        >
          Shared Pool
        </FilterChip>
      </div>

      <div className="glass-card flex h-10 items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search course, programme, category, section..."
          disabled={disabled}
        />
        {search ? (
          <button type="button" onClick={() => setSearch('')}>
            <X className="h-4 w-4" />
          </button>
        ) : null}
        {contexts.isFetching ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {recent.length ? (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground">Recent Teaching Contexts</p>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((row) => (
              <button
                key={row.offeringSectionId}
                type="button"
                className="rounded-full border border-border/60 bg-muted/40 px-2 py-1 text-[11px] hover:bg-muted"
                onClick={() => toggle(row)}
                disabled={disabled || assignedSet.has(row.offeringSectionId)}
              >
                {row.course.code} • {row.programVersion.program.code} • {row.sectionCode}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="max-h-80 overflow-y-auto rounded-xl border border-border/60">
        {rows.length === 0 && !contexts.isFetching ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            No configured teaching contexts found.
          </p>
        ) : (
          rows.map((row) => {
            const checked = Boolean(selected[row.offeringSectionId]);
            const unavailable = assignedSet.has(row.offeringSectionId);
            return (
              <button
                key={row.offeringSectionId}
                type="button"
                className={cn(
                  'flex w-full items-start gap-3 border-b border-border/50 px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/40',
                  checked && 'bg-primary/5',
                  unavailable && 'cursor-not-allowed opacity-60',
                )}
                onClick={() => toggle(row)}
                disabled={disabled || unavailable}
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
                  <span className="block truncate text-sm font-semibold">{contextTitle(row)}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {contextMeta(row)}
                  </span>
                  {row.teachingTeam?.length ? (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {row.teachingTeam.map((member) => (
                        <span
                          key={member.id}
                          className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] text-primary"
                        >
                          {member.shortCode || member.employeeCode || member.staffName} ·{' '}
                          {roleLabel(member.role)}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {row.assignmentStatus === 'AVAILABLE'
                    ? row.teachingTeam?.length
                      ? 'Team exists'
                      : 'Available'
                    : row.assignmentStatus === 'ASSIGNED_TO_THIS_STAFF'
                      ? 'Assigned'
                      : 'Team exists'}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {selectedRows.length
            ? `${selectedRows.length} teaching context(s) selected`
            : 'Select configured delivery sections to assign.'}
        </p>
        <Button
          type="button"
          size="sm"
          className="h-8 text-xs"
          disabled={disabled || submitting || !selectedRows.length}
          onClick={() => void apply()}
        >
          {submitting ? 'Assigning...' : confirmLabel}
        </Button>
      </div>
    </div>
  );
}

function SelectFilter({
  label,
  value,
  disabled,
  onChange,
  children,
}: {
  label: string;
  value: string | number;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1 text-[11px]">
      <span className="font-medium text-muted-foreground">{label}</span>
      <select
        className="glass-card h-9 w-full rounded-lg border border-border/60 bg-background/70 px-2 text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {children}
      </select>
    </label>
  );
}

function FilterChip({
  active,
  disabled,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
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
