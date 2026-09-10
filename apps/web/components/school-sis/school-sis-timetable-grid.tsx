'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  moveSchoolSisTimetableSlot,
  saveSchoolSisTimetableSlot,
  type SchoolSisTimetableGrid,
  type SchoolSisTimetableSlot,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

export const TIMETABLE_DAYS: Array<{ id: number; short: string; full: string }> = [
  { id: 1, short: 'MON', full: 'Monday' },
  { id: 2, short: 'TUE', full: 'Tuesday' },
  { id: 3, short: 'WED', full: 'Wednesday' },
  { id: 4, short: 'THU', full: 'Thursday' },
  { id: 5, short: 'FRI', full: 'Friday' },
  { id: 6, short: 'SAT', full: 'Saturday' },
];

export function formatBellClock(start: string, end: string) {
  return `${toDisplayTime(start)} – ${toDisplayTime(end)}`;
}

function toDisplayTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hr = ((h + 11) % 12) + 1;
  return `${hr}:${String(m ?? 0).padStart(2, '0')} ${suffix}`;
}

type Props = {
  grid: SchoolSisTimetableGrid;
  canEdit?: boolean;
  subjects: Array<{ id: string; name: string }>;
  staff: Array<{ id: string; fullName: string }>;
  queryKey: unknown[];
  mode?: 'class' | 'teacher';
  printTitle?: string;
  printSub?: string;
};

export function SchoolSisTimetableGrid({
  grid,
  canEdit,
  subjects,
  staff,
  queryKey,
  mode = 'class',
  printTitle,
  printSub,
}: Props) {
  const qc = useQueryClient();
  const days = TIMETABLE_DAYS.filter((d) => grid.days.includes(d.id));
  const [mobileDay, setMobileDay] = useState(days[0]?.id ?? 1);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ dayOfWeek: number; bellId: string } | null>(null);
  const [form, setForm] = useState({
    subjectId: '',
    staffId: '',
    roomLabel: '',
    notes: '',
    allowOverride: false,
  });

  const slotMap = useMemo(() => {
    const map = new Map<string, SchoolSisTimetableSlot>();
    for (const slot of grid.slots) map.set(`${slot.dayOfWeek}:${slot.bellId}`, slot);
    return map;
  }, [grid.slots]);

  const save = useMutation({
    mutationFn: () => {
      if (!editing || !grid.section) throw new Error('Select a class section');
      return saveSchoolSisTimetableSlot({
        sectionId: grid.section.id,
        bellId: editing.bellId,
        dayOfWeek: editing.dayOfWeek,
        planId: grid.plan?.id,
        subjectId: form.subjectId || null,
        staffId: form.staffId || null,
        roomLabel: form.roomLabel || null,
        notes: form.notes || null,
        allowOverride: form.allowOverride,
      });
    },
    onSuccess: () => {
      setError(null);
      setEditing(null);
      void qc.invalidateQueries({ queryKey });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const move = useMutation({
    mutationFn: (payload: { slotId: string; bellId: string; dayOfWeek: number }) =>
      moveSchoolSisTimetableSlot(payload),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const openCell = (dayOfWeek: number, bellId: string, slot?: SchoolSisTimetableSlot) => {
    if (!canEdit || mode !== 'class') return;
    setForm({
      subjectId: slot?.subjectId ?? '',
      staffId: slot?.staffId ?? '',
      roomLabel: slot?.roomLabel ?? '',
      notes: slot?.notes ?? '',
      allowOverride: false,
    });
    setEditing({ dayOfWeek, bellId });
    setError(null);
  };

  const printPage = () => window.print();

  return (
    <div className="sls-tt">
      <div className="sls-tt-print-header hidden">
        <p className="text-sm font-bold uppercase tracking-wide text-[#1a365d]">
          St. Luke&apos;s Hr. Secondary School
        </p>
        <p className="text-xs text-slate-500">Walbakgre, Tura · West Garo Hills, Meghalaya</p>
        {printTitle ? <p className="mt-2 text-sm font-semibold">{printTitle}</p> : null}
        {printSub ? <p className="text-xs text-slate-500">{printSub}</p> : null}
      </div>
      {error ? <p className="mb-3 text-sm text-red-600 sls-profile-print-hide">{error}</p> : null}
      <div className="sls-profile-print-hide mb-3 flex flex-wrap gap-2">
        {days.map((day) => (
          <button
            key={day.id}
            type="button"
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold lg:hidden',
              mobileDay === day.id
                ? 'bg-[#1a365d] text-white'
                : 'border border-slate-200 bg-white text-slate-600',
            )}
            onClick={() => setMobileDay(day.id)}
          >
            {day.full}
          </button>
        ))}
        <button
          type="button"
          className="ml-auto hidden rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 lg:inline-flex"
          onClick={printPage}
        >
          Print / PDF
        </button>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="sls-tt-table min-w-[880px] w-full border-collapse text-left text-xs">
          <thead>
            <tr>
              <th className="sls-tt-axis">Days</th>
              {grid.bells.map((bell) => (
                <th
                  key={bell.id}
                  className={cn('sls-tt-head', bell.kind === 'BREAK' && 'is-break')}
                >
                  <span className="block font-semibold uppercase tracking-wide">{bell.label}</span>
                  <span className="font-normal text-slate-500">
                    {formatBellClock(bell.startTime, bell.endTime)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.id}>
                <th className="sls-tt-day">{day.short}</th>
                {grid.bells.map((bell) => {
                  if (bell.kind === 'BREAK') {
                    return (
                      <td key={bell.id} className="sls-tt-break">
                        {bell.label}
                      </td>
                    );
                  }
                  const slot = slotMap.get(`${day.id}:${bell.id}`);
                  return (
                    <td
                      key={bell.id}
                      className="sls-tt-cell"
                      draggable={Boolean(canEdit && slot && mode === 'class')}
                      onDragStart={(e) => {
                        if (!slot) return;
                        e.dataTransfer.setData('text/plain', slot.id);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const slotId = e.dataTransfer.getData('text/plain');
                        if (slotId) move.mutate({ slotId, bellId: bell.id, dayOfWeek: day.id });
                      }}
                      onClick={() => openCell(day.id, bell.id, slot)}
                    >
                      {slot?.subject ? (
                        <div>
                          <p className="font-semibold text-[#1a365d]">{slot.subject.name}</p>
                          <p className="text-slate-500">{slot.staff?.fullName ?? 'No teacher'}</p>
                          {slot.roomLabel ? (
                            <p className="text-slate-400">{slot.roomLabel}</p>
                          ) : null}
                          {mode === 'teacher' && slot.section ? (
                            <p className="text-slate-400">
                              {slot.section.grade.name} {slot.section.name}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-slate-400">Free Period</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {grid.bells.map((bell) => {
          if (bell.kind === 'BREAK') {
            return (
              <div
                key={bell.id}
                className="rounded-xl bg-sky-50 px-4 py-3 text-center text-sm font-semibold text-sky-800"
              >
                {bell.label} · {formatBellClock(bell.startTime, bell.endTime)}
              </div>
            );
          }
          const slot = slotMap.get(`${mobileDay}:${bell.id}`);
          return (
            <button
              key={bell.id}
              type="button"
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"
              onClick={() => openCell(mobileDay, bell.id, slot)}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {bell.label} · {formatBellClock(bell.startTime, bell.endTime)}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#1a365d]">
                {slot?.subject?.name ?? 'Free Period'}
              </p>
              {slot?.staff ? <p className="text-sm text-slate-500">{slot.staff.fullName}</p> : null}
              {slot?.roomLabel ? <p className="text-xs text-slate-400">{slot.roomLabel}</p> : null}
            </button>
          );
        })}
      </div>

      {editing && canEdit ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <form
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <h3 className="text-base font-semibold text-[#1a365d]">Edit timetable entry</h3>
            <p className="mt-1 text-xs text-slate-500">
              {TIMETABLE_DAYS.find((d) => d.id === editing.dayOfWeek)?.full} ·{' '}
              {grid.bells.find((b) => b.id === editing.bellId)?.label}
            </p>
            <label className="mt-4 block text-xs font-semibold text-slate-500">
              Subject
              <select
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                value={form.subjectId}
                onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}
              >
                <option value="">Free period</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-xs font-semibold text-slate-500">
              Teacher
              <select
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                value={form.staffId}
                onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}
              >
                <option value="">Not assigned</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-xs font-semibold text-slate-500">
              Room
              <input
                list="sls-tt-rooms"
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                value={form.roomLabel}
                onChange={(e) => setForm((f) => ({ ...f, roomLabel: e.target.value }))}
                placeholder="Select or type a room"
              />
              <datalist id="sls-tt-rooms">
                {grid.rooms?.map((r) => (
                  <option key={r.id} value={r.name} />
                ))}
              </datalist>
            </label>
            <label className="mt-3 block text-xs font-semibold text-slate-500">
              Notes
              <input
                className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={form.allowOverride}
                onChange={(e) => setForm((f) => ({ ...f, allowOverride: e.target.checked }))}
              />
              Allow override if there is a teacher or room conflict
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border px-4 py-2 text-sm"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white"
                disabled={save.isPending}
              >
                Save
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
