'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookmarkPlus, ChevronDown, Eraser, Eye, Loader2, Users, X } from 'lucide-react';

import {
  compactAudienceFilter,
  EMPTY_AUDIENCE_FILTER,
  formatSemesterLabel,
} from '@/components/communication/audience/audience-filter.utils';
import { AUDIENCE_OPTIONS } from '@/components/communication/comm-center-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createAudienceSegment,
  fetchAudienceContext,
  fetchAudienceSegments,
  previewCommunicationAudience,
  previewCommunicationAudienceCount,
} from '@/services/communication';
import { fetchAcademicDepartments } from '@/services/organization';
import { fetchShifts } from '@/services/shifts';
import { fetchStudents } from '@/services/students';
import type { AudienceCountResult, AudienceFilter, ResolvedRecipient } from '@/types/communication';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const FEE_STATUS_OPTIONS = [
  { value: '', label: 'Any fee status' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'DEFAULTERS', label: 'Defaulters' },
] as const;

const ATTENDANCE_PRESETS = [
  { label: '< 75%', below: 75, above: undefined },
  { label: '< 60%', below: 60, above: undefined },
  { label: '< 50%', below: 50, above: undefined },
  { label: '> 90%', below: undefined, above: 90 },
] as const;

type Chip = { key: string; label: string; onRemove: () => void };

export type AdvancedAudiencePanelProps = {
  audienceType: string;
  filter: AudienceFilter;
  onAudienceTypeChange: (type: string) => void;
  onFilterChange: (next: AudienceFilter) => void;
  showSavedAudiences?: boolean;
  onUseInCompose?: (payload: {
    audienceType: string;
    filter: AudienceFilter;
    segmentId?: string;
  }) => void;
  className?: string;
  onCountChange?: (count: AudienceCountResult | null) => void;
};

function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-1 flex items-baseline justify-between gap-2">
      <label className="text-sm font-medium text-foreground">{children}</label>
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function CheckList({
  options,
  values,
  onChange,
  maxHeight = 'max-h-36',
}: {
  options: { id: string; label: string }[];
  values: string[];
  onChange: (ids: string[]) => void;
  maxHeight?: string;
}) {
  const selected = new Set(values);
  return (
    <div
      className={cn('space-y-1 overflow-y-auto rounded-xl border border-border/70 p-2', maxHeight)}
    >
      {options.length === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground">No options</p>
      ) : (
        options.map((o) => {
          const on = selected.has(o.id);
          return (
            <label
              key={o.id}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50',
                on && 'bg-primary/10',
              )}
            >
              <input
                type="checkbox"
                className="rounded border-border"
                checked={on}
                onChange={() => {
                  if (on) onChange(values.filter((id) => id !== o.id));
                  else onChange([...values, o.id]);
                }}
              />
              <span className="truncate">{o.label}</span>
            </label>
          );
        })
      )}
    </div>
  );
}

export function AdvancedAudiencePanel({
  audienceType,
  filter,
  onAudienceTypeChange,
  onFilterChange,
  showSavedAudiences = true,
  onUseInCompose,
  className,
  onCountChange,
}: AdvancedAudiencePanelProps) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [segmentName, setSegmentName] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [customAttendance, setCustomAttendance] = useState('');
  const [count, setCount] = useState<AudienceCountResult | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [counting, setCounting] = useState(false);
  const [deptQuery, setDeptQuery] = useState('');

  const context = useQuery({
    queryKey: ['communication', 'audience-context'],
    queryFn: fetchAudienceContext,
    enabled,
    staleTime: 60_000,
  });

  const departments = useQuery({
    queryKey: ['departments', 'academic', 'ACTIVE'],
    queryFn: () => fetchAcademicDepartments({ status: 'ACTIVE' }),
    enabled,
  });
  const shifts = useQuery({
    queryKey: ['shifts', 'active'],
    queryFn: () => fetchShifts({ status: 'ACTIVE' }),
    enabled,
  });
  const segments = useQuery({
    queryKey: ['communication', 'segments'],
    queryFn: fetchAudienceSegments,
    enabled: enabled && showSavedAudiences,
  });

  const semesterOptions = useMemo(() => {
    const seqs = context.data?.currentSemesterSequences ?? [];
    return seqs.map((n) => ({ id: String(n), label: formatSemesterLabel(n), sequence: n }));
  }, [context.data?.currentSemesterSequences]);

  const deptOptions = useMemo(() => {
    const q = deptQuery.trim().toLowerCase();
    return (departments.data ?? [])
      .filter((d) => !q || d.name.toLowerCase().includes(q))
      .map((d) => ({ id: d.id, label: d.name }));
  }, [departments.data, deptQuery]);

  const compact = useMemo(() => {
    return compactAudienceFilter({
      ...filter,
      academicYearIds: undefined,
      semesterIds: undefined,
      programVersionIds: undefined,
    });
  }, [filter]);

  // Drop semester picks that are outside the active ODD/EVEN cycle (stale state / old segments).
  useEffect(() => {
    const allowed = context.data?.currentSemesterSequences;
    if (!allowed?.length) return;
    const current = filter.semesterSequences ?? [];
    if (!current.length) return;
    const next = current.filter((n) => allowed.includes(n));
    if (next.length === current.length) return;
    onFilterChange({ ...filter, semesterSequences: next, academicYearIds: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.data?.currentSemesterSequences]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setCounting(true);
      setCountError(null);
      try {
        const result = await previewCommunicationAudienceCount({
          audienceType,
          audienceFilter: compact,
        });
        if (!cancelled) {
          setCount(result);
          onCountChange?.(result);
        }
      } catch (e) {
        if (!cancelled) {
          setCount(null);
          onCountChange?.(null);
          setCountError(apiErrorMessage(e, 'Could not count recipients'));
        }
      } finally {
        if (!cancelled) setCounting(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceType, compact]);

  const preview = useMutation({
    mutationFn: () =>
      previewCommunicationAudience({
        audienceType,
        audienceFilter: compact,
      }),
  });

  const saveSegment = useMutation({
    mutationFn: () =>
      createAudienceSegment({
        name: segmentName.trim(),
        audienceType,
        filters: compact as Record<string, unknown>,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communication', 'segments'] });
      setSegmentName('');
    },
  });

  const studentLookup = useQuery({
    queryKey: ['audience-student-search', studentSearch],
    queryFn: () => fetchStudents({ search: studentSearch, limit: 12, page: 1 }),
    enabled: enabled && studentSearch.trim().length >= 2,
  });

  function patch(partial: Partial<AudienceFilter>) {
    onFilterChange({ ...filter, ...partial, academicYearIds: undefined });
  }

  function clearAll() {
    onFilterChange({ ...EMPTY_AUDIENCE_FILTER });
    setCustomAttendance('');
    setDeptQuery('');
  }

  function applySegment(segment: {
    id: string;
    audienceType: string;
    filters?: AudienceFilter | Record<string, unknown>;
  }) {
    const loaded = { ...(segment.filters as AudienceFilter) };
    delete loaded.academicYearIds;
    onAudienceTypeChange(segment.audienceType);
    onFilterChange({ ...EMPTY_AUDIENCE_FILTER, ...loaded });
  }

  const selectedSequences = filter.semesterSequences ?? [];
  const selectedBatches = filter.admissionBatchIds ?? filter.batchIds ?? [];

  const chips: Chip[] = [];
  const deptMap = new Map((departments.data ?? []).map((d) => [d.id, d.name]));
  for (const id of filter.shiftIds ?? []) {
    const shift = (shifts.data ?? []).find((s) => s.id === id);
    chips.push({
      key: `shift-${id}`,
      label: shift?.name ?? 'Shift',
      onRemove: () => patch({ shiftIds: (filter.shiftIds ?? []).filter((x) => x !== id) }),
    });
  }
  for (const id of filter.departmentIds ?? []) {
    chips.push({
      key: `dept-${id}`,
      label: deptMap.get(id) ?? 'Department',
      onRemove: () =>
        patch({ departmentIds: (filter.departmentIds ?? []).filter((x) => x !== id) }),
    });
  }
  for (const n of selectedSequences) {
    chips.push({
      key: `sem-${n}`,
      label: formatSemesterLabel(n),
      onRemove: () => patch({ semesterSequences: selectedSequences.filter((x) => x !== n) }),
    });
  }
  for (const id of selectedBatches) {
    const batch = context.data?.admissionBatches.find((b) => b.id === id);
    chips.push({
      key: `batch-${id}`,
      label: batch?.label ?? 'Batch',
      onRemove: () =>
        patch({
          admissionBatchIds: selectedBatches.filter((x) => x !== id),
          batchIds: [],
        }),
    });
  }
  if (filter.gender) {
    chips.push({
      key: 'gender',
      label: `Gender: ${filter.gender}`,
      onRemove: () => patch({ gender: undefined }),
    });
  }
  if (filter.feeStatus) {
    chips.push({
      key: 'fee',
      label: `Fee: ${filter.feeStatus}`,
      onRemove: () => patch({ feeStatus: undefined }),
    });
  }
  if (filter.attendanceBelowPct != null) {
    chips.push({
      key: 'att-below',
      label: `Att < ${filter.attendanceBelowPct}%`,
      onRemove: () => patch({ attendanceBelowPct: undefined }),
    });
  }
  if (filter.residenceType) {
    chips.push({
      key: 'res',
      label: filter.residenceType.replace('_', ' '),
      onRemove: () => patch({ residenceType: undefined }),
    });
  }

  const byType = count?.byAudienceType ?? {};
  const isStudentish = ['STUDENTS', 'PARENTS', 'ALUMNI', 'ALL_USERS', 'DEPARTMENTS'].includes(
    audienceType,
  );
  const showCurrentSemester = ['STUDENTS', 'PARENTS', 'ALL_USERS', 'DEPARTMENTS'].includes(
    audienceType,
  );
  const sessionLabel = context.data?.activeAcademicYear?.name ?? '—';
  const cycleLabel = context.data?.currentCycle ?? '—';

  return (
    <div className={className ?? 'space-y-4'}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Who should receive this?</h2>
          <p className="text-xs text-muted-foreground">
            Shift · Department · Current semester (academic standing)
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
          <Eraser className="mr-1 h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-xs text-sky-950 dark:text-sky-100">
        {context.isLoading ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading academic context…
          </span>
        ) : context.isError ? (
          <span className="text-destructive">Could not load academic cycle context.</span>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                <span className="font-semibold">Active session:</span> {sessionLabel}
              </span>
              <span className="hidden text-sky-700/50 sm:inline dark:text-sky-300/50">|</span>
              <span>
                <span className="font-semibold">Cycle:</span> {cycleLabel}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed opacity-85">
              Academic Year is college settings — not a student filter. Recipient counts use{' '}
              <span className="font-medium">current semester standing</span> (same engine as Student
              Directory).
            </p>
          </>
        )}
      </div>

      <div>
        <FieldLabel>Audience</FieldLabel>
        <select
          className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
          value={audienceType}
          onChange={(e) => {
            const next = e.target.value;
            onAudienceTypeChange(next);
            if (next === 'ALUMNI') {
              patch({ semesterSequences: [] });
            }
          }}
        >
          {AUDIENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {audienceType === 'APPLICANTS' ? (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Applicant targeting is not available yet.
          </p>
        ) : null}
      </div>

      {chips.length ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.onRemove}
              className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5 text-xs"
            >
              {c.label}
              <X className="h-3 w-3 opacity-60" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="space-y-2 rounded-xl border border-border/80 bg-card p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4" />
          Recipients found
          {counting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        </div>
        {countError ? (
          <p className="text-xs text-destructive">{countError}</p>
        ) : (
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-2xl font-semibold tabular-nums">{count?.total ?? '—'}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Students {byType.STUDENT ?? 0} · Staff {byType.FACULTY ?? 0} · Parents{' '}
              {byType.PARENT ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">
              Email {count?.withEmail ?? 0} · Mobile {count?.withPhone ?? 0}
            </p>
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={preview.isPending}
          onClick={() => {
            setPreviewOpen(true);
            preview.mutate();
          }}
        >
          <Eye className="mr-1 h-3.5 w-3.5" />
          Preview list
        </Button>
      </div>

      {isStudentish ? (
        <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Essentials
          </p>

          <div>
            <FieldLabel hint="optional — all if none">Shift</FieldLabel>
            <CheckList
              options={(shifts.data ?? []).map((s) => ({ id: s.id, label: s.name }))}
              values={filter.shiftIds ?? []}
              onChange={(shiftIds) => patch({ shiftIds })}
              maxHeight="max-h-28"
            />
          </div>

          <div>
            <FieldLabel hint="by major subject">Department</FieldLabel>
            <Input
              className="mb-1.5"
              placeholder="Search department…"
              value={deptQuery}
              onChange={(e) => setDeptQuery(e.target.value)}
            />
            <CheckList
              options={deptOptions}
              values={filter.departmentIds ?? []}
              onChange={(departmentIds) => patch({ departmentIds })}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Matches the student&apos;s Major (same as Student Records), not only home department.
            </p>
          </div>

          <div>
            <FieldLabel hint="from active cycle">Current semester</FieldLabel>
            {showCurrentSemester ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {semesterOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No active semester sequences.</p>
                  ) : (
                    semesterOptions.map((s) => {
                      const on = selectedSequences.includes(s.sequence);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            const next = on
                              ? selectedSequences.filter((x) => x !== s.sequence)
                              : [...selectedSequences, s.sequence].sort((a, b) => a - b);
                            patch({ semesterSequences: next });
                          }}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-sm transition',
                            on
                              ? 'border-primary bg-primary/15 font-medium text-primary'
                              : 'border-border/70 hover:bg-muted/50',
                          )}
                        >
                          {s.label}
                        </button>
                      );
                    })
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Leave empty for all current students. Counts use academic standing — not calendar
                  year or programme registration alone.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Current semester does not apply to Alumni. Use Admission batch under More filters
                for cohort announcements.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
          <div>
            <FieldLabel>Department</FieldLabel>
            <Input
              className="mb-1.5"
              placeholder="Search department…"
              value={deptQuery}
              onChange={(e) => setDeptQuery(e.target.value)}
            />
            <CheckList
              options={deptOptions}
              values={filter.departmentIds ?? []}
              onChange={(departmentIds) => patch({ departmentIds })}
            />
          </div>
        </div>
      )}

      <button
        type="button"
        className="flex w-full items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-sm font-medium hover:bg-muted/40"
        onClick={() => setShowMore((v) => !v)}
      >
        More filters (batch, gender, fees…)
        <ChevronDown className={cn('h-4 w-4 transition', showMore && 'rotate-180')} />
      </button>

      {showMore ? (
        <div className="space-y-3 rounded-xl border border-dashed border-border/70 p-3">
          <div>
            <FieldLabel hint="permanent cohort">Admission batch</FieldLabel>
            <CheckList
              options={(context.data?.admissionBatches ?? []).map((b) => ({
                id: b.id,
                label: `${b.label} · now Sem ${b.currentSemester}`,
              }))}
              values={selectedBatches}
              onChange={(admissionBatchIds) =>
                patch({ admissionBatchIds, batchIds: admissionBatchIds })
              }
              maxHeight="max-h-40"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Use for convocation / placement / batch announcements. Does not replace current
              semester.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>Gender</FieldLabel>
              <select
                className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
                value={filter.gender ?? ''}
                onChange={(e) => patch({ gender: e.target.value || undefined })}
              >
                <option value="">All</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <FieldLabel>Hostel</FieldLabel>
              <select
                className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
                value={filter.residenceType ?? ''}
                onChange={(e) => patch({ residenceType: e.target.value || undefined })}
              >
                <option value="">Any</option>
                <option value="HOSTELLER">Hosteller</option>
                <option value="DAY_SCHOLAR">Day Scholar</option>
              </select>
            </div>
          </div>

          <div>
            <FieldLabel>Fee status</FieldLabel>
            <select
              className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
              value={filter.feeStatus ?? ''}
              onChange={(e) =>
                patch({
                  feeStatus: (e.target.value || undefined) as AudienceFilter['feeStatus'],
                })
              }
            >
              {FEE_STATUS_OPTIONS.map((o) => (
                <option key={o.value || 'any'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>Attendance</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {ATTENDANCE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="rounded-full border border-border/70 px-2.5 py-0.5 text-xs hover:bg-muted/50"
                  onClick={() =>
                    patch({
                      attendanceBelowPct: p.below,
                      attendanceAbovePct: p.above,
                    })
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                type="number"
                placeholder="Custom below %"
                value={customAttendance}
                onChange={(e) => setCustomAttendance(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!customAttendance}
                onClick={() =>
                  patch({
                    attendanceBelowPct: Number(customAttendance),
                    attendanceAbovePct: undefined,
                  })
                }
              >
                Apply
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>Roll from</FieldLabel>
              <Input
                value={filter.rollNumberFrom ?? ''}
                onChange={(e) => patch({ rollNumberFrom: e.target.value || undefined })}
              />
            </div>
            <div>
              <FieldLabel>Roll to</FieldLabel>
              <Input
                value={filter.rollNumberTo ?? ''}
                onChange={(e) => patch({ rollNumberTo: e.target.value || undefined })}
              />
            </div>
          </div>

          <div>
            <FieldLabel>Find a student</FieldLabel>
            <Input
              placeholder="Name or roll…"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
            />
            {studentLookup.data?.data?.length ? (
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">
                {studentLookup.data.data.map(
                  (s: {
                    id: string;
                    fullName?: string | null;
                    rollNumber?: string | null;
                    enrollmentNumber?: string;
                  }) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/50 px-2 py-1"
                    >
                      <span className="truncate">
                        {s.fullName ?? s.enrollmentNumber}
                        {s.rollNumber ? ` · ${s.rollNumber}` : ''}
                      </span>
                      <span className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          className="text-emerald-700 hover:underline"
                          onClick={() =>
                            patch({
                              studentIds: Array.from(new Set([...(filter.studentIds ?? []), s.id])),
                              excludeStudentIds: (filter.excludeStudentIds ?? []).filter(
                                (x) => x !== s.id,
                              ),
                            })
                          }
                        >
                          Include
                        </button>
                        <button
                          type="button"
                          className="text-rose-700 hover:underline"
                          onClick={() =>
                            patch({
                              excludeStudentIds: Array.from(
                                new Set([...(filter.excludeStudentIds ?? []), s.id]),
                              ),
                              studentIds: (filter.studentIds ?? []).filter((x) => x !== s.id),
                            })
                          }
                        >
                          Exclude
                        </button>
                      </span>
                    </li>
                  ),
                )}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {previewOpen ? (
        <PreviewDialog
          loading={preview.isPending}
          error={preview.error ? apiErrorMessage(preview.error, 'Preview failed') : null}
          recipients={preview.data ?? []}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}

      {showSavedAudiences ? (
        <div className="space-y-2 border-t border-border/60 pt-3">
          <p className="text-sm font-medium">Saved audiences</p>
          {onUseInCompose ? (
            <Button
              type="button"
              className="w-full"
              variant="outline"
              size="sm"
              onClick={() => onUseInCompose({ audienceType, filter: compact })}
            >
              Use in Compose
            </Button>
          ) : null}
          <div className="flex gap-2">
            <Input
              placeholder="Name this audience"
              value={segmentName}
              onChange={(e) => setSegmentName(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!segmentName.trim() || saveSegment.isPending}
              onClick={() => saveSegment.mutate()}
            >
              <BookmarkPlus className="mr-1 h-3.5 w-3.5" />
              Save
            </Button>
          </div>
          <ul className="max-h-36 space-y-1.5 overflow-y-auto">
            {(
              (segments.data as {
                id: string;
                name: string;
                audienceType: string;
                filters?: AudienceFilter;
              }[]) ?? []
            ).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-1.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground">{s.audienceType}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => applySegment(s)}>
                    Load
                  </Button>
                  {onUseInCompose ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onUseInCompose({
                          audienceType: s.audienceType,
                          filter: {
                            ...EMPTY_AUDIENCE_FILTER,
                            ...(s.filters as AudienceFilter),
                          },
                          segmentId: s.id,
                        })
                      }
                    >
                      Use
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function PreviewDialog({
  loading,
  error,
  recipients,
  onClose,
}: {
  loading: boolean;
  error: string | null;
  recipients: ResolvedRecipient[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <h3 className="font-semibold">Preview ({recipients.length})</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4 text-sm">
          {loading ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : error ? (
            <p className="text-destructive">{error}</p>
          ) : recipients.length === 0 ? (
            <p className="text-muted-foreground">No recipients matched.</p>
          ) : (
            <ul className="space-y-1.5">
              {recipients.slice(0, 200).map((r, i) => (
                <li key={`${r.userId ?? r.studentId ?? r.displayName}-${i}`} className="text-xs">
                  <span className="font-medium">{r.displayName}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {r.recipientType}
                    {r.email ? ` · ${r.email}` : ''}
                  </span>
                </li>
              ))}
              {recipients.length > 200 ? (
                <li className="text-muted-foreground">…and {recipients.length - 200} more</li>
              ) : null}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
