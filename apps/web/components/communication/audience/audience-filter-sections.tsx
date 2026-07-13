'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  ATTENDANCE_PRESETS,
  CheckList,
  FEE_STATUS_OPTIONS,
  FieldLabel,
  STAFF_STATUS_OPTIONS,
} from '@/components/communication/audience/audience-filter-shared';
import { formatSemesterLabel } from '@/components/communication/audience/audience-filter.utils';
import type { AudienceFilterSection } from '@/components/communication/audience/audience-filter-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchGovernanceCommittees } from '@/services/governance';
import { fetchAcademicDepartments } from '@/services/organization';
import { fetchDesignations, fetchStaff } from '@/services/staff';
import { fetchShifts } from '@/services/shifts';
import { fetchStudents } from '@/services/students';
import type { AudienceContext, AudienceFilter } from '@/types/communication';
import { cn } from '@/utils/cn';

export type AudienceFilterSectionsProps = {
  sections: AudienceFilterSection[];
  filter: AudienceFilter;
  patch: (partial: Partial<AudienceFilter>) => void;
  context?: AudienceContext | null;
  title?: string;
  className?: string;
};

export function AudienceFilterSections({
  sections,
  filter,
  patch,
  context,
  title,
  className,
}: AudienceFilterSectionsProps) {
  const enabled = useAuthQueryEnabled();
  const [deptQuery, setDeptQuery] = useState('');
  const [designationQuery, setDesignationQuery] = useState('');
  const [committeeQuery, setCommitteeQuery] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [customAttendance, setCustomAttendance] = useState('');

  const departments = useQuery({
    queryKey: ['departments', 'academic', 'ACTIVE'],
    queryFn: () => fetchAcademicDepartments({ status: 'ACTIVE' }),
    enabled: enabled && sections.includes('department'),
  });
  const shifts = useQuery({
    queryKey: ['shifts', 'active'],
    queryFn: () => fetchShifts({ status: 'ACTIVE' }),
    enabled: enabled && sections.includes('shift'),
  });
  const designations = useQuery({
    queryKey: ['staff', 'designations'],
    queryFn: () => fetchDesignations(),
    enabled: enabled && (sections.includes('designation') || sections.includes('staffRolePresets')),
  });
  const committees = useQuery({
    queryKey: ['governance', 'committees', 'audience'],
    queryFn: () => fetchGovernanceCommittees({ status: 'ACTIVE', limit: 200 }),
    enabled: enabled && sections.includes('committee'),
  });
  const studentLookup = useQuery({
    queryKey: ['audience-student-search', studentSearch],
    queryFn: () => fetchStudents({ search: studentSearch, limit: 12, page: 1 }),
    enabled: enabled && sections.includes('studentSearch') && studentSearch.trim().length >= 2,
  });
  const staffLookup = useQuery({
    queryKey: ['audience-staff-search', staffSearch],
    queryFn: () => fetchStaff({ search: staffSearch, limit: 12, page: 1 }),
    enabled: enabled && sections.includes('staffSearch') && staffSearch.trim().length >= 2,
  });

  const semesterOptions = useMemo(() => {
    const seqs = context?.currentSemesterSequences ?? [];
    return seqs.map((n) => ({ id: String(n), label: formatSemesterLabel(n), sequence: n }));
  }, [context?.currentSemesterSequences]);

  const deptOptions = useMemo(() => {
    const q = deptQuery.trim().toLowerCase();
    return (departments.data ?? [])
      .filter((d) => !q || d.name.toLowerCase().includes(q))
      .map((d) => ({ id: d.id, label: d.name }));
  }, [departments.data, deptQuery]);

  const designationOptions = useMemo(() => {
    const q = designationQuery.trim().toLowerCase();
    return (designations.data ?? [])
      .filter((d) => !q || d.label.toLowerCase().includes(q) || d.code.toLowerCase().includes(q))
      .map((d) => ({ id: d.id, label: d.label }));
  }, [designations.data, designationQuery]);

  const committeeOptions = useMemo(() => {
    const q = committeeQuery.trim().toLowerCase();
    const rows = committees.data?.items ?? [];
    return rows
      .filter(
        (c) => !q || c.name.toLowerCase().includes(q) || c.shortCode.toLowerCase().includes(q),
      )
      .map((c) => ({
        id: c.id,
        label: c.memberCount != null ? `${c.name} (${c.memberCount})` : c.name,
      }));
  }, [committees.data, committeeQuery]);

  const selectedSequences = filter.semesterSequences ?? [];
  const selectedBatches = filter.admissionBatchIds ?? filter.batchIds ?? [];

  function matchDesignationIds(patterns: RegExp[]) {
    return (designations.data ?? [])
      .filter((d) => patterns.some((p) => p.test(d.label) || p.test(d.code)))
      .map((d) => d.id);
  }

  function toggleRolePreset(preset: 'all' | 'teaching' | 'nonTeaching' | 'hod' | 'principal') {
    if (preset === 'all') {
      patch({
        teaching: undefined,
        nonTeaching: undefined,
        designationIds: [],
      });
      return;
    }
    if (preset === 'teaching') {
      patch({ teaching: true, nonTeaching: undefined });
      return;
    }
    if (preset === 'nonTeaching') {
      patch({ nonTeaching: true, teaching: undefined });
      return;
    }
    if (preset === 'hod') {
      const ids = matchDesignationIds([/\bhod\b/i, /head of department/i, /\bhead\b/i]);
      patch({
        designationIds: Array.from(new Set([...(filter.designationIds ?? []), ...ids])),
      });
      return;
    }
    if (preset === 'principal') {
      const ids = matchDesignationIds([/principal/i, /vice\s*principal/i, /\bvp\b/i]);
      patch({
        designationIds: Array.from(new Set([...(filter.designationIds ?? []), ...ids])),
      });
    }
  }

  if (!sections.length) return null;

  return (
    <div className={cn('space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3', className)}>
      {title ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      ) : null}

      {sections.includes('staffRolePresets') ? (
        <div>
          <FieldLabel hint="optional">Recipients</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'all', label: 'All Staff', active: !filter.teaching && !filter.nonTeaching },
                { id: 'teaching', label: 'Teaching Staff', active: Boolean(filter.teaching) },
                {
                  id: 'nonTeaching',
                  label: 'Non-Teaching Staff',
                  active: Boolean(filter.nonTeaching),
                },
                { id: 'hod', label: 'Heads of Department', active: false },
                { id: 'principal', label: 'Principal / VP', active: false },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleRolePreset(p.id)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm transition',
                  p.active
                    ? 'border-primary bg-primary/15 font-medium text-primary'
                    : 'border-border/70 hover:bg-muted/50',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Principal / HOD presets add matching designations from your HR catalog.
          </p>
        </div>
      ) : null}

      {sections.includes('shift') ? (
        <div>
          <FieldLabel hint="optional — all if none">Shift</FieldLabel>
          <CheckList
            options={(shifts.data ?? []).map((s) => ({ id: s.id, label: s.name }))}
            values={filter.shiftIds ?? []}
            onChange={(shiftIds) => patch({ shiftIds })}
            maxHeight="max-h-28"
          />
        </div>
      ) : null}

      {sections.includes('department') ? (
        <div>
          <FieldLabel hint="optional">Department</FieldLabel>
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
      ) : null}

      {sections.includes('semester') ? (
        <div>
          <FieldLabel hint="from active cycle">Current semester</FieldLabel>
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
        </div>
      ) : null}

      {sections.includes('admissionBatch') ? (
        <div>
          <FieldLabel hint="permanent cohort">Admission batch</FieldLabel>
          <CheckList
            options={(context?.admissionBatches ?? []).map((b) => ({
              id: b.id,
              label: `${b.label} · now Sem ${b.currentSemester}`,
            }))}
            values={selectedBatches}
            onChange={(admissionBatchIds) =>
              patch({ admissionBatchIds, batchIds: admissionBatchIds })
            }
            maxHeight="max-h-40"
          />
        </div>
      ) : null}

      {sections.includes('designation') ? (
        <div>
          <FieldLabel hint="from HR catalog">Designation</FieldLabel>
          <Input
            className="mb-1.5"
            placeholder="Search designation…"
            value={designationQuery}
            onChange={(e) => setDesignationQuery(e.target.value)}
          />
          <CheckList
            options={designationOptions}
            values={filter.designationIds ?? []}
            onChange={(designationIds) => patch({ designationIds })}
          />
        </div>
      ) : null}

      {sections.includes('employmentStatus') ? (
        <div>
          <FieldLabel hint="optional">Employment status</FieldLabel>
          <CheckList
            options={STAFF_STATUS_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
            values={filter.staffStatuses ?? []}
            onChange={(staffStatuses) => {
              patch({
                staffStatuses,
                // Let staffStatuses drive resolveFaculty; clear boolean employment shortcuts.
                permanent: undefined,
                contract: undefined,
              });
            }}
            maxHeight="max-h-40"
          />
        </div>
      ) : null}

      {sections.includes('committee') ? (
        <div>
          <FieldLabel>Committees</FieldLabel>
          <Input
            className="mb-1.5"
            placeholder="Search committee…"
            value={committeeQuery}
            onChange={(e) => setCommitteeQuery(e.target.value)}
          />
          <CheckList
            options={committeeOptions}
            values={filter.committeeIds ?? []}
            onChange={(committeeIds) => patch({ committeeIds })}
            maxHeight="max-h-48"
          />
          {!committeeOptions.length ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              No active committees found. Create committees under Governance first.
            </p>
          ) : null}
        </div>
      ) : null}

      {sections.includes('gender') ? (
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
      ) : null}

      {sections.includes('hostel') ? (
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
      ) : null}

      {sections.includes('feeStatus') ? (
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
      ) : null}

      {sections.includes('attendance') ? (
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
      ) : null}

      {sections.includes('rollRange') ? (
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
      ) : null}

      {sections.includes('studentSearch') ? (
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
      ) : null}

      {sections.includes('staffSearch') ? (
        <div>
          <FieldLabel>Search employee</FieldLabel>
          <Input
            placeholder="Staff name or employee ID…"
            value={staffSearch}
            onChange={(e) => setStaffSearch(e.target.value)}
          />
          {staffLookup.data?.data?.length ? (
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">
              {staffLookup.data.data.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/50 px-2 py-1"
                >
                  <span className="truncate">
                    {s.fullName}
                    {s.employeeCode ? ` · ${s.employeeCode}` : ''}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-emerald-700 hover:underline"
                    onClick={() =>
                      patch({
                        staffProfileIds: Array.from(
                          new Set([...(filter.staffProfileIds ?? []), s.id]),
                        ),
                      })
                    }
                  >
                    Include
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {(filter.staffProfileIds ?? []).length ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {(filter.staffProfileIds ?? []).length} staff included ·{' '}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => patch({ staffProfileIds: [] })}
              >
                Clear
              </button>
            </p>
          ) : null}
        </div>
      ) : null}

      {sections.includes('userSearch') ? (
        <p className="text-[11px] text-muted-foreground">
          Use staff or student search below to include specific people. Selected IDs are stored on
          the campaign filter.
        </p>
      ) : null}
    </div>
  );
}
