'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled, useRequireAuth } from '@/hooks/use-auth';
import { useWorkspaceBoundShiftState } from '@/hooks/use-workspace-bound-shift-state';
import {
  assignElectiveStaff,
  fetchElectiveDepartments,
  fetchElectiveFacultyOptions,
  fetchElectiveRoomOptions,
  fetchElectiveSlotOptions,
  fetchElectiveStaffAllocations,
  fetchTimetableContext,
  type ElectiveAllocationRow,
} from '@/services/timetable';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const CATEGORIES = ['MDC', 'AEC', 'SEC', 'VAC', 'VTC'] as const;

type AssignForm = {
  staffProfileId: string;
  sectionCode: string;
  teachingDepartmentId: string;
  classroomId: string;
  capacity: string;
  workloadHours: string;
  daysOfWeek: number[];
  periodNo: string;
  saturdayPeriodNo: string;
  notes: string;
};

const WEEKDAYS = [
  { dayOfWeek: 1, label: 'Mon' },
  { dayOfWeek: 2, label: 'Tue' },
  { dayOfWeek: 3, label: 'Wed' },
  { dayOfWeek: 4, label: 'Thu' },
  { dayOfWeek: 5, label: 'Fri' },
  { dayOfWeek: 6, label: 'Sat' },
] as const;

const emptyForm = (): AssignForm => ({
  staffProfileId: '',
  sectionCode: 'A',
  teachingDepartmentId: '',
  classroomId: '',
  capacity: '',
  workloadHours: '',
  daysOfWeek: [1, 2, 3, 4, 5],
  periodNo: '',
  saturdayPeriodNo: '',
  notes: '',
});

export default function ElectiveStaffAllocationPage() {
  useRequireAuth();
  const authReady = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [semesterMode, setSemesterMode] = useState<'ODD' | 'EVEN'>('ODD');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selected, setSelected] = useState<ElectiveAllocationRow | null>(null);
  const [form, setForm] = useState<AssignForm>(emptyForm);
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

  useEffect(() => {
    if (!effectiveShiftId && (contextQ.data?.shifts?.length ?? 0) > 0) {
      setShiftId(contextQ.data!.shifts[0]!.id);
    }
  }, [contextQ.data?.shifts, effectiveShiftId, setShiftId]);

  const params = useMemo(
    () => ({
      semesterMode,
      shiftId: effectiveShiftId,
      category: category || undefined,
      q: q.trim() || undefined,
    }),
    [category, effectiveShiftId, q, semesterMode],
  );

  const rowsQ = useQuery({
    queryKey: ['timetable', 'elective-staff-allocation', params],
    queryFn: () => fetchElectiveStaffAllocations(params),
    enabled: authReady && Boolean(effectiveShiftId),
  });

  const facultyQ = useQuery({
    queryKey: ['timetable', 'elective-faculty', effectiveShiftId],
    queryFn: () => fetchElectiveFacultyOptions(effectiveShiftId),
    enabled: authReady && Boolean(effectiveShiftId),
  });

  const roomsQ = useQuery({
    queryKey: ['timetable', 'elective-rooms'],
    queryFn: fetchElectiveRoomOptions,
    enabled: authReady,
  });

  const slotsQ = useQuery({
    queryKey: ['timetable', 'elective-slots', effectiveShiftId],
    queryFn: () => fetchElectiveSlotOptions(effectiveShiftId),
    enabled: authReady && Boolean(effectiveShiftId),
  });

  const departmentsQ = useQuery({
    queryKey: ['timetable', 'elective-departments'],
    queryFn: fetchElectiveDepartments,
    enabled: authReady,
  });

  const rows = rowsQ.data ?? [];
  const assignedCount = rows.filter((r) => r.staffProfileId).length;

  const periodChoices = useMemo(() => {
    const map = new Map<
      number,
      { periodNo: number; label: string; startTime: string; endTime: string }
    >();
    // Prefer Monday (day 1) times when deduping — matches Day Shift master grid.
    const ordered = [...(slotsQ.data ?? [])].sort(
      (a, b) => a.dayOfWeek - b.dayOfWeek || a.periodNo - b.periodNo,
    );
    for (const slot of ordered) {
      if (!map.has(slot.periodNo)) {
        map.set(slot.periodNo, {
          periodNo: slot.periodNo,
          label: slot.label,
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
      }
    }
    return [...map.values()].sort((a, b) => {
      // Teaching order: 1..6 then BREAK (0) after period 3 visually — keep numeric sort but
      // show break after P3 by putting 0 between 3 and 4.
      const rank = (n: number) => (n === 0 ? 3.5 : n);
      return rank(a.periodNo) - rank(b.periodNo);
    });
  }, [slotsQ.data]);

  const saturdayPeriodChoices = useMemo(() => {
    const map = new Map<
      number,
      { periodNo: number; label: string; startTime: string; endTime: string }
    >();
    for (const slot of slotsQ.data ?? []) {
      if (slot.dayOfWeek !== 6 || slot.periodNo <= 0) continue;
      if (!map.has(slot.periodNo)) {
        map.set(slot.periodNo, {
          periodNo: slot.periodNo,
          label: slot.label,
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.periodNo - b.periodNo);
  }, [slotsQ.data]);

  function openAssign(row: ElectiveAllocationRow) {
    setSelected(row);
    setError('');
    setSuccess('');
    const existingDays = [...new Set((row.slots ?? []).map((s) => s.dayOfWeek))].sort(
      (a, b) => a - b,
    );
    const isVtc = (row.category ?? '').toUpperCase() === 'VTC';
    const weekdaySlot = row.slots?.find((s) => s.dayOfWeek !== 6);
    const saturdaySlot = row.slots?.find((s) => s.dayOfWeek === 6);
    const defaultDays = existingDays.length
      ? existingDays
      : isVtc
        ? [1, 2, 3, 4, 5, 6]
        : [1, 2, 3, 4, 5];
    setForm({
      staffProfileId: row.staffProfileId ?? '',
      sectionCode: row.sectionCode ?? 'A',
      teachingDepartmentId: '',
      classroomId: row.classroomId ?? '',
      capacity: row.capacity != null ? String(row.capacity) : '',
      workloadHours: row.weeklyHours ? String(row.weeklyHours) : String(defaultDays.length),
      daysOfWeek: defaultDays,
      periodNo: weekdaySlot?.periodNo != null ? String(weekdaySlot.periodNo) : isVtc ? '4' : '',
      saturdayPeriodNo:
        saturdaySlot?.periodNo != null ? String(saturdaySlot.periodNo) : isVtc ? '2' : '',
      notes: '',
    });
  }

  const assignMut = useMutation({
    mutationFn: async () => {
      if (!selected || !effectiveShiftId) throw new Error('Select a subject and shift');
      if (!form.staffProfileId) throw new Error('Select a faculty member');
      const period = periodChoices.find((p) => String(p.periodNo) === form.periodNo);
      const daysOfWeek = form.daysOfWeek;
      const includeSaturday = daysOfWeek.includes(6);
      return assignElectiveStaff({
        courseOfferingId: selected.courseOfferingId,
        shiftId: effectiveShiftId,
        staffProfileId: form.staffProfileId,
        sectionCode: form.sectionCode || 'A',
        ...(form.teachingDepartmentId ? { teachingDepartmentId: form.teachingDepartmentId } : {}),
        ...(form.classroomId ? { classroomId: form.classroomId } : {}),
        ...(form.capacity ? { capacity: Number(form.capacity) } : {}),
        workloadHours: form.workloadHours
          ? Number(form.workloadHours)
          : daysOfWeek.length || undefined,
        ...(daysOfWeek.length === 1 ? { dayOfWeek: daysOfWeek[0] } : {}),
        ...(daysOfWeek.length ? { daysOfWeek } : {}),
        ...(form.periodNo ? { periodNo: Number(form.periodNo) } : {}),
        ...(includeSaturday && form.saturdayPeriodNo
          ? { saturdayPeriodNo: Number(form.saturdayPeriodNo) }
          : {}),
        ...(period?.startTime ? { startTime: period.startTime } : {}),
        ...(period?.endTime ? { endTime: period.endTime } : {}),
        ...(form.notes ? { notes: form.notes } : {}),
        ...(contextQ.data?.academicYears?.[0]?.id
          ? { academicYearId: contextQ.data.academicYears[0].id }
          : {}),
      });
    },
    onSuccess: async (res) => {
      const days = (res.planEntries ?? [])
        .map((e) => {
          const day = e.dayName?.slice(0, 3) ?? '';
          return e.startTime && e.endTime ? `${day} ${e.startTime}–${e.endTime}` : day;
        })
        .filter(Boolean);
      const skipped = (res.skippedDays ?? []).map((d) => `${d.dayName}: ${d.reason}`).join(' · ');
      setSuccess(
        days.length
          ? `Assigned ${selected?.subjectCode ?? ''} · ${days.join(', ')}${
              skipped ? `. Skipped ${skipped}` : ''
            }`
          : 'Faculty assigned to elective section',
      );
      setError('');
      setSelected(null);
      await qc.invalidateQueries({ queryKey: ['timetable', 'elective-staff-allocation'] });
    },
    onError: (e) => {
      setError(apiErrorMessage(e));
      setSuccess('');
    },
  });

  return (
    <DashboardShell role="admin" title="Elective Staff Allocation">
      <div className="space-y-5">
        <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-sky-500/10 via-card to-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-700 dark:text-sky-300">
            FYUGP pool electives
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Elective Subject Staff Allocation</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Assign any department faculty to <strong>MDC / AEC / SEC / VAC / VTC</strong> offerings
            with day, period, and room. Major/Minor stay in{' '}
            <Link
              href="/admin/academics/teaching-allocation"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Teaching Allocation
            </Link>{' '}
            /{' '}
            <Link
              href="/admin/academics/department-workload"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Department Workload
            </Link>
            .
          </p>
        </section>

        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
            {success}
          </p>
        ) : null}

        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-5">
            <select
              className="h-10 rounded-md border bg-card px-3 text-sm"
              value={semesterMode}
              onChange={(e) => setSemesterMode(e.target.value as 'ODD' | 'EVEN')}
            >
              <option value="ODD">ODD: Sem 1, 3, 5</option>
              <option value="EVEN">EVEN: Sem 2, 4, 6</option>
            </select>
            {!hideShiftFilter ? (
              <select
                className="h-10 rounded-md border bg-card px-3 text-sm"
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value)}
              >
                <option value="">Select shift</option>
                {(contextQ.data?.shifts ?? []).map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
                {workspaceShiftLabel ?? 'Workspace shift'}
              </div>
            )}
            <select
              className="h-10 rounded-md border bg-card px-3 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All elective types</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Input
              placeholder="Search subject / faculty…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 md:col-span-2"
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Elective rows" value={rows.length} />
          <Metric label="Faculty assigned" value={assignedCount} tone="green" />
          <Metric label="Still open" value={rows.length - assignedCount} tone="yellow" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pool offerings</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {!effectiveShiftId ? (
              <p className="text-sm text-muted-foreground">Select a shift to load electives.</p>
            ) : rowsQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No MDC/AEC/SEC/VAC/VTC offerings found for this filter. Ensure Category Pools and
                offerings exist in Academic Engine.
              </p>
            ) : (
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Subject</th>
                    <th className="px-2 py-2">Sem</th>
                    <th className="px-2 py-2">Section</th>
                    <th className="px-2 py-2">Faculty</th>
                    <th className="px-2 py-2">Slot</th>
                    <th className="px-2 py-2">Room</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/60 align-top">
                      <td className="px-2 py-2">
                        <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-sky-800 dark:text-sky-200">
                          {row.category}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <p className="font-medium">
                          {row.subjectCode} · {row.subjectName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[row.poolName, row.homeDepartment].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </td>
                      <td className="px-2 py-2">{row.semesterSequence ?? '—'}</td>
                      <td className="px-2 py-2">{row.sectionCode ?? '—'}</td>
                      <td className="px-2 py-2">
                        {row.staffName ? (
                          <>
                            <p className="font-medium">{row.staffName}</p>
                            <p className="text-xs text-muted-foreground">
                              {[row.staffCode, row.staffDepartment].filter(Boolean).join(' · ')}
                            </p>
                          </>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-300">Unassigned</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {(row.slots ?? []).length
                          ? (row.slots ?? [])
                              .map((s) => `${s.dayName?.slice(0, 3)} P${s.periodNo ?? ''}`)
                              .join(', ')
                          : '—'}
                      </td>
                      <td className="px-2 py-2">{row.classroom ?? '—'}</td>
                      <td className="px-2 py-2 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openAssign(row)}
                        >
                          Assign
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">Assign faculty</h3>
                <p className="text-xs text-muted-foreground">
                  {selected.category} · {selected.subjectCode} · {selected.subjectName}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
            <div className="space-y-3">
              {error ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Field label="Faculty (any department)">
                <select
                  className="h-10 w-full rounded-md border bg-card px-3 text-sm"
                  value={form.staffProfileId}
                  onChange={(e) => {
                    const staffProfileId = e.target.value;
                    const faculty = (facultyQ.data ?? []).find((f) => f.id === staffProfileId);
                    setForm((f) => ({
                      ...f,
                      staffProfileId,
                      teachingDepartmentId: f.teachingDepartmentId || faculty?.departmentId || '',
                    }));
                  }}
                >
                  <option value="">Select faculty</option>
                  {(facultyQ.data ?? []).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.fullName}
                      {f.department ? ` · ${f.department}` : ''}
                      {f.staffType ? ` · ${String(f.staffType).replace(/_/g, ' ')}` : ''}
                      {f.employeeCode ? ` (${f.employeeCode})` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              {(selected.enrolledDepartments?.length ?? 0) > 0 ? (
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs">
                  <p className="font-semibold text-sky-900 dark:text-sky-100">
                    Students who opted this paper ({selected.enrolledTotal ?? 0}) — already in this
                    one section. You do not add their departments here.
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {selected.enrolledDepartments
                      ?.map((d) => `${d.name} (${d.students})`)
                      .join(' · ')}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Every department&apos;s students who chose this VTC sit in this same section. You
                  do not list student departments in the reporting field below.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Section / batch">
                  <Input
                    value={form.sectionCode}
                    onChange={(e) => setForm((f) => ({ ...f, sectionCode: e.target.value }))}
                  />
                </Field>
                <Field label="Capacity">
                  <Input
                    type="number"
                    value={form.capacity}
                    onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                  />
                </Field>
              </div>
              <Field label="Workload reporting department (faculty HOD)">
                <select
                  className="h-10 w-full rounded-md border bg-card px-3 text-sm"
                  value={form.teachingDepartmentId}
                  onChange={(e) => setForm((f) => ({ ...f, teachingDepartmentId: e.target.value }))}
                >
                  <option value="">College-wide (all student departments)</option>
                  {(departmentsQ.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Who reports this teaching load — for Kaushik Paul that is Computer Science. Leave
                  College-wide if no single HOD should own it.
                </p>
              </Field>
              <Field label="Room / Lab">
                <select
                  className="h-10 w-full rounded-md border bg-card px-3 text-sm"
                  value={form.classroomId}
                  onChange={(e) => setForm((f) => ({ ...f, classroomId: e.target.value }))}
                >
                  <option value="">Optional</option>
                  {(roomsQ.data ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code}
                      {r.roomType ? ` · ${r.roomType}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Weekday period (Mon–Fri)">
                <select
                  className="h-10 w-full rounded-md border bg-card px-3 text-sm"
                  value={form.periodNo}
                  onChange={(e) => setForm((f) => ({ ...f, periodNo: e.target.value }))}
                >
                  <option value="">No slot yet</option>
                  {periodChoices.map((p) => (
                    <option key={p.periodNo} value={p.periodNo}>
                      {p.label} ({p.startTime}-{p.endTime})
                    </option>
                  ))}
                </select>
              </Field>
              {form.daysOfWeek.includes(6) ? (
                <Field label="Saturday period">
                  <select
                    className="h-10 w-full rounded-md border bg-card px-3 text-sm"
                    value={form.saturdayPeriodNo}
                    onChange={(e) => setForm((f) => ({ ...f, saturdayPeriodNo: e.target.value }))}
                  >
                    <option value="">Select Saturday period</option>
                    {(saturdayPeriodChoices.length ? saturdayPeriodChoices : periodChoices)
                      .filter((p) => p.periodNo > 0 && p.periodNo <= 3)
                      .map((p) => (
                        <option key={p.periodNo} value={p.periodNo}>
                          {p.label} ({p.startTime}-{p.endTime})
                        </option>
                      ))}
                  </select>
                </Field>
              ) : null}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Repeat on</p>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d) => {
                    const active = form.daysOfWeek.includes(d.dayOfWeek);
                    return (
                      <button
                        key={d.dayOfWeek}
                        type="button"
                        className={cn(
                          'h-8 rounded-md border px-2.5 text-xs font-semibold',
                          active
                            ? 'border-sky-600 bg-sky-600 text-white'
                            : 'border-border bg-card text-muted-foreground',
                        )}
                        onClick={() =>
                          setForm((f) => {
                            const adding = !f.daysOfWeek.includes(d.dayOfWeek);
                            const next = adding
                              ? [...f.daysOfWeek, d.dayOfWeek].sort((a, b) => a - b)
                              : f.daysOfWeek.filter((n) => n !== d.dayOfWeek);
                            return {
                              ...f,
                              daysOfWeek: next,
                              saturdayPeriodNo:
                                adding && d.dayOfWeek === 6 && !f.saturdayPeriodNo
                                  ? '2'
                                  : f.saturdayPeriodNo,
                              workloadHours:
                                !f.workloadHours || Number(f.workloadHours) === f.daysOfWeek.length
                                  ? String(next.length || '')
                                  : f.workloadHours,
                            };
                          })
                        }
                      >
                        {d.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="h-8 rounded-md border border-border px-2.5 text-xs"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        daysOfWeek: [1, 2, 3, 4, 5, 6],
                        saturdayPeriodNo: f.saturdayPeriodNo || '2',
                        workloadHours: f.workloadHours || '6',
                      }))
                    }
                  >
                    Mon–Sat
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  College routine: VTC is Period 4 (12:40–13:25) Monday–Friday and Period 2
                  (10:40–11:25) on Saturday. Tick Sat and set Saturday period — one save creates all
                  slots.
                </p>
              </div>
              <Field label="Weekly hours">
                <Input
                  type="number"
                  value={form.workloadHours}
                  onChange={(e) => setForm((f) => ({ ...f, workloadHours: e.target.value }))}
                />
              </Field>
              <Field label="Notes">
                <Input
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={assignMut.isPending || !form.staffProfileId}
                  onClick={() => assignMut.mutate()}
                >
                  {assignMut.isPending ? 'Saving…' : 'Save assignment'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'green' | 'yellow' | 'red';
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card p-4',
        tone === 'green' && 'border-emerald-500/30',
        tone === 'yellow' && 'border-amber-500/30',
        tone === 'red' && 'border-destructive/30',
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
