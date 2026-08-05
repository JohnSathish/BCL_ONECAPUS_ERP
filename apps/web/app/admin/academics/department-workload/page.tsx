'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Send, ShieldCheck } from 'lucide-react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled, useRequireAuth } from '@/hooks/use-auth';
import { useWorkspaceBoundShiftState } from '@/hooks/use-workspace-bound-shift-state';
import { fetchInfrastructureRooms } from '@/services/infrastructure';
import { fetchAllStaff } from '@/services/staff';
import {
  assignDepartmentWorkload,
  fetchDepartmentWorkloadPlans,
  fetchDepartmentWorkloadSheet,
  fetchFacultyWorkloadAvailability,
  fetchTimetableContext,
  transitionDepartmentWorkloadStatus,
  type DepartmentWorkloadRow,
} from '@/services/timetable';
import { cn } from '@/utils/cn';

const STATUS_FLOW = [
  'DRAFT',
  'SUBMITTED',
  'HOD_APPROVED',
  'ACADEMIC_OFFICE_APPROVED',
  'PUBLISHED',
] as const;

function workloadTone(status?: string | null) {
  if (status === 'RED') return 'text-rose-600 bg-rose-50 border-rose-200';
  if (status === 'YELLOW') return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-emerald-700 bg-emerald-50 border-emerald-200';
}

export default function DepartmentWorkloadPage() {
  useRequireAuth();
  const authReady = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [semesterMode, setSemesterMode] = useState<'ODD' | 'EVEN'>('ODD');
  const [planId, setPlanId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [facultySearch, setFacultySearch] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { staffProfileId: string; classroomId: string }>
  >({});
  const [error, setError] = useState<string | null>(null);
  const { shiftId, setShiftId, effectiveShiftId, hideShiftFilter, workspaceShiftLabel } =
    useWorkspaceBoundShiftState();

  const contextQ = useQuery({
    queryKey: ['timetable', 'context'],
    queryFn: fetchTimetableContext,
    enabled: authReady,
  });

  useEffect(() => {
    if (contextQ.data?.currentAcademicMode) {
      setSemesterMode(contextQ.data.currentAcademicMode);
    }
  }, [contextQ.data?.currentAcademicMode]);

  const plansQ = useQuery({
    queryKey: ['timetable', 'department-workload-plans', semesterMode, effectiveShiftId],
    queryFn: () =>
      fetchDepartmentWorkloadPlans({
        semesterMode,
        shiftId: effectiveShiftId,
      }),
    enabled: authReady,
  });

  useEffect(() => {
    if (!planId && plansQ.data?.[0]?.id) setPlanId(plansQ.data[0].id);
  }, [planId, plansQ.data]);

  const sheetParams = useMemo(
    () => ({
      planId: planId || undefined,
      departmentId: departmentId || undefined,
      semesterMode,
      shiftId: effectiveShiftId,
    }),
    [departmentId, effectiveShiftId, planId, semesterMode],
  );

  const sheetQ = useQuery({
    queryKey: ['timetable', 'department-workload', sheetParams],
    queryFn: () => fetchDepartmentWorkloadSheet(sheetParams),
    enabled: authReady,
  });

  const staffQ = useQuery({
    queryKey: ['staff', 'all', 'department-workload', departmentId],
    queryFn: () =>
      fetchAllStaff({
        status: 'ACTIVE',
        activeTeachingOnly: true,
        departmentId: departmentId || undefined,
      }),
    enabled: authReady,
  });

  const roomsQ = useQuery({
    queryKey: ['infrastructure', 'rooms', 'timetable'],
    queryFn: () => fetchInfrastructureRooms({ availableForTimetable: 'true' }),
    enabled: authReady,
  });

  const availabilityQ = useQuery({
    queryKey: ['timetable', 'faculty-availability', selectedStaffId, planId, semesterMode],
    queryFn: () =>
      fetchFacultyWorkloadAvailability(selectedStaffId!, {
        planId: planId || undefined,
        semesterMode,
      }),
    enabled: authReady && Boolean(selectedStaffId),
  });

  const rows = sheetQ.data?.rows ?? [];
  const staff = staffQ.data?.data ?? [];
  const rooms = roomsQ.data ?? [];
  const departments = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.departmentId) {
        map.set(row.departmentId, row.department ?? row.departmentId);
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filteredStaff = useMemo(() => {
    const q = facultySearch.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) => {
      const hay = `${s.fullName} ${s.shortCode ?? ''} ${s.employeeCode ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [facultySearch, staff]);

  useEffect(() => {
    if (!rows.length) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        if (!next[row.id]) {
          next[row.id] = {
            staffProfileId: row.staffProfileId ?? '',
            classroomId: row.classroomId ?? '',
          };
        }
      }
      return next;
    });
  }, [rows]);

  const assignMut = useMutation({
    mutationFn: assignDepartmentWorkload,
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['timetable', 'department-workload'] });
      qc.invalidateQueries({ queryKey: ['timetable', 'faculty-availability'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? err?.message ?? 'Assign failed');
    },
  });

  const statusMut = useMutation({
    mutationFn: transitionDepartmentWorkloadStatus,
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['timetable'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? err?.message ?? 'Status update failed');
    },
  });

  function rowPayload(row: DepartmentWorkloadRow) {
    const draft = drafts[row.id] ?? {
      staffProfileId: row.staffProfileId ?? '',
      classroomId: row.classroomId ?? '',
    };
    return {
      entryId: row.entryId || undefined,
      offeringSectionId: row.offeringSectionId || undefined,
      staffProfileId: draft.staffProfileId || null,
      classroomId: draft.classroomId || null,
      status: 'DRAFT',
    };
  }

  async function saveRow(row: DepartmentWorkloadRow) {
    await assignMut.mutateAsync(rowPayload(row));
    const draft = drafts[row.id];
    if (draft?.staffProfileId) setSelectedStaffId(draft.staffProfileId);
  }

  function transition(status: string) {
    const entryIds = rows.map((r) => r.entryId).filter(Boolean) as string[];
    const sectionIds = rows.map((r) => r.offeringSectionId).filter(Boolean) as string[];
    statusMut.mutate({
      status,
      planId: (sheetQ.data?.plan?.id ?? planId) || undefined,
      entryIds: entryIds.length ? entryIds : undefined,
      sectionIds: sectionIds.length ? sectionIds : undefined,
    });
  }

  return (
    <DashboardShell role="admin" title="Department Workload">
      <div className="space-y-5">
        <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-sky-500/10 via-card to-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-700">
            HOD allocation layer
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Department Workload Allocation</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Assign faculty and rooms to master slots for your department&apos;s{' '}
            <strong>Major / Minor</strong> papers. Clash checks run on save. Move draft rows through
            HOD and Academic Office approval before publish. For{' '}
            <strong>MDC / AEC / SEC / VAC / VTC</strong>, assign any-department faculty and slots on{' '}
            <a
              className="font-medium text-sky-800 underline-offset-2 hover:underline"
              href="/admin/academics/elective-staff-allocation"
            >
              Elective Staff Allocation
            </a>
            .
          </p>
          <ol className="mt-4 max-w-3xl list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Pick Odd/Even semester and the timetable plan for your shift.</li>
            <li>For each day/slot row, choose Faculty and Room, then click Save.</li>
            <li>Use the Availability panel to check weekly hours before overloading faculty.</li>
            <li>When ready: Submit → HOD approve → Academic Office approve.</li>
          </ol>
        </section>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Semester mode</span>
              <select
                className="block h-9 rounded-md border border-border bg-background px-2 text-sm"
                value={semesterMode}
                onChange={(e) => setSemesterMode(e.target.value as 'ODD' | 'EVEN')}
              >
                <option value="ODD">Odd</option>
                <option value="EVEN">Even</option>
              </select>
            </label>
            {!hideShiftFilter ? (
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">Shift</span>
                <select
                  className="block h-9 rounded-md border border-border bg-background px-2 text-sm"
                  value={shiftId}
                  onChange={(e) => setShiftId(e.target.value)}
                >
                  <option value="">All shifts</option>
                  {(contextQ.data?.shifts ?? []).map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name ?? s.code ?? s.id}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="space-y-1 text-xs">
                <span className="text-muted-foreground">Shift</span>
                <p className="h-9 rounded-md border border-border bg-muted/40 px-2 py-2 text-sm">
                  {workspaceShiftLabel}
                </p>
              </div>
            )}
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Timetable plan</span>
              <select
                className="block h-9 min-w-[220px] rounded-md border border-border bg-background px-2 text-sm"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
              >
                <option value="">Auto / subject fallback</option>
                {(plansQ.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.status})
                  </option>
                ))}
              </select>
            </label>
            {departments.length > 1 ? (
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">Department</span>
                <select
                  className="block h-9 rounded-md border border-border bg-background px-2 text-sm"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                >
                  <option value="">All in scope</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
              <div>
                <CardTitle className="text-base">Workload sheet</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Mode: {sheetQ.data?.mode ?? '…'}
                  {sheetQ.data?.plan
                    ? ` · ${sheetQ.data.plan.name} · ${sheetQ.data.plan.approvalState}`
                    : ' · subject allocation fallback'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={statusMut.isPending || !rows.length}
                  onClick={() => transition('SUBMITTED')}
                >
                  <Send className="mr-1 h-3.5 w-3.5" />
                  Submit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={statusMut.isPending || !rows.length}
                  onClick={() => transition('HOD_APPROVED')}
                >
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                  HOD approve
                </Button>
                <Button
                  size="sm"
                  disabled={statusMut.isPending || !rows.length}
                  onClick={() => transition('ACADEMIC_OFFICE_APPROVED')}
                >
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  Academic Office
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {error ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2 text-[11px]">
                {STATUS_FLOW.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5"
                  >
                    {s.replaceAll('_', ' ')}
                  </span>
                ))}
              </div>
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Day / Slot</th>
                      <th className="px-3 py-2">Subject</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Faculty</th>
                      <th className="px-3 py-2">Room</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {sheetQ.isLoading ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                          Loading sheet…
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                          No department slots or subject rows for this filter.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => {
                        const draft = drafts[row.id] ?? {
                          staffProfileId: row.staffProfileId ?? '',
                          classroomId: row.classroomId ?? '',
                        };
                        return (
                          <tr key={row.id} className="border-t border-border/50 align-top">
                            <td className="px-3 py-2 whitespace-nowrap">
                              <div className="font-medium">
                                {row.dayName ?? '—'}
                                {row.periodNo != null ? ` · P${row.periodNo}` : ''}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {[row.startTime, row.endTime].filter(Boolean).join(' – ') ||
                                  'Subject row'}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium">
                                {row.subjectCode ?? '—'} {row.subjectName ?? ''}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Sem {row.semester ?? '—'}
                                {row.sectionCode ? ` · ${row.sectionCode}` : ''}
                                {row.department ? ` · ${row.department}` : ''}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <span className="rounded-md border border-border/70 px-1.5 py-0.5 text-xs">
                                {row.fyugpCategory ?? row.subjectSlot ?? '—'}
                              </span>
                            </td>
                            <td className="px-3 py-2 min-w-[180px]">
                              <select
                                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                value={draft.staffProfileId}
                                onChange={(e) => {
                                  const staffProfileId = e.target.value;
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [row.id]: { ...draft, staffProfileId },
                                  }));
                                  if (staffProfileId) setSelectedStaffId(staffProfileId);
                                }}
                              >
                                <option value="">Select faculty</option>
                                {filteredStaff.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.shortCode ? `${s.shortCode} — ` : ''}
                                    {s.fullName}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 min-w-[140px]">
                              <select
                                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                value={draft.classroomId}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [row.id]: {
                                      ...draft,
                                      classroomId: e.target.value,
                                    },
                                  }))
                                }
                              >
                                <option value="">Select room</option>
                                {rooms.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.code} — {r.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={cn(
                                  'inline-flex rounded-md border px-1.5 py-0.5 text-[11px]',
                                  workloadTone(row.workloadStatus),
                                )}
                              >
                                {row.status ?? 'DRAFT'}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={assignMut.isPending}
                                onClick={() => saveRow(row)}
                              >
                                Save
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Faculty search</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input
                  placeholder="Search name / code…"
                  value={facultySearch}
                  onChange={(e) => setFacultySearch(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {filteredStaff.length} faculty in picker
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Availability</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!selectedStaffId ? (
                  <p className="text-muted-foreground">
                    Select a faculty in the sheet to see weekly hours and occupied slots.
                  </p>
                ) : availabilityQ.isLoading ? (
                  <p className="text-muted-foreground">Loading availability…</p>
                ) : availabilityQ.data ? (
                  <>
                    <div>
                      <p className="font-medium">{availabilityQ.data.staffName}</p>
                      <p className="text-xs text-muted-foreground">
                        {availabilityQ.data.shortCode ?? availabilityQ.data.employeeCode}
                        {availabilityQ.data.department ? ` · ${availabilityQ.data.department}` : ''}
                      </p>
                    </div>
                    <div
                      className={cn(
                        'rounded-lg border px-3 py-2 text-xs',
                        workloadTone(availabilityQ.data.workloadStatus),
                      )}
                    >
                      <div>
                        Assigned {availabilityQ.data.assignedWeeklyHours}h / max{' '}
                        {availabilityQ.data.maxWeeklyHours}h
                      </div>
                      <div>Remaining {availabilityQ.data.remainingHours}h</div>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Subjects
                      </p>
                      <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
                        {availabilityQ.data.assignedSubjects.length === 0 ? (
                          <li className="text-muted-foreground">None yet</li>
                        ) : (
                          availabilityQ.data.assignedSubjects.map((s) => (
                            <li key={`${s.offeringSectionId}-${s.subjectCode}`}>
                              {s.subjectCode} · {s.weeklyHours}h
                              {s.category ? ` · ${s.category}` : ''}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Occupied slots
                      </p>
                      <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                        {availabilityQ.data.occupiedSlots.length === 0 ? (
                          <li className="text-muted-foreground">No occupied slots</li>
                        ) : (
                          availabilityQ.data.occupiedSlots.map((s) => (
                            <li key={s.entryId}>
                              {s.dayName}
                              {s.periodNo != null ? ` P${s.periodNo}` : ''} ·{' '}
                              {s.subjectName ?? 'Slot'}
                              {s.classroomCode ? ` · ${s.classroomCode}` : ''}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">Could not load availability.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
