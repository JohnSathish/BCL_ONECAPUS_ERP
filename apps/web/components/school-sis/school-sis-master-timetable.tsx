'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TIMETABLE_DAYS, formatBellClock } from '@/components/school-sis/school-sis-timetable-grid';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchSchoolSisMasters,
  fetchSchoolSisMasterTimetable,
  fetchSchoolSisStaff,
} from '@/services/school-sis';

export function SchoolSisMasterTimetable() {
  const enabled = useAuthQueryEnabled();
  const [dayOfWeek, setDayOfWeek] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [room, setRoom] = useState('');
  const masters = useQuery({
    queryKey: ['school-sis-masters'],
    queryFn: fetchSchoolSisMasters,
    enabled,
  });
  const staff = useQuery({ queryKey: ['school-sis-staff'], queryFn: fetchSchoolSisStaff, enabled });
  const grid = useQuery({
    queryKey: ['school-sis-timetable-master', dayOfWeek, sectionId, staffId, room],
    queryFn: () =>
      fetchSchoolSisMasterTimetable({
        dayOfWeek: dayOfWeek ? Number(dayOfWeek) : undefined,
        sectionId: sectionId || undefined,
        staffId: staffId || undefined,
        room: room || undefined,
      }),
    enabled,
  });

  const dayLabel = (id: number) => TIMETABLE_DAYS.find((d) => d.id === id)?.full ?? String(id);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#1a365d]">Master timetable</h1>
        <p className="text-sm text-slate-500">
          School-wide view for spotting teacher and room clashes.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4">
        <select
          className="h-10 rounded-lg border px-3 text-sm"
          value={dayOfWeek}
          onChange={(e) => setDayOfWeek(e.target.value)}
        >
          <option value="">All days</option>
          {TIMETABLE_DAYS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.full}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-lg border px-3 text-sm"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
        >
          <option value="">All classes</option>
          {(masters.data?.sections ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.grade.name} {s.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-lg border px-3 text-sm"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
        >
          <option value="">All teachers</option>
          {(staff.data ?? [])
            .filter((s) => s.staffType === 'TEACHING')
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
        </select>
        <input
          className="h-10 rounded-lg border px-3 text-sm"
          placeholder="Room"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
        />
        <button
          type="button"
          className="h-10 rounded-xl border px-3 text-sm"
          onClick={() => window.print()}
        >
          Print / PDF
        </button>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Day</th>
              <th className="px-3 py-2">Period</th>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Teacher</th>
              <th className="px-3 py-2">Room</th>
            </tr>
          </thead>
          <tbody>
            {(grid.data?.slots ?? []).map((slot) => (
              <tr key={slot.id} className="border-t">
                <td className="px-3 py-2">{dayLabel(slot.dayOfWeek)}</td>
                <td className="px-3 py-2">
                  {slot.bell
                    ? `${slot.bell.label} (${formatBellClock(slot.bell.startTime, slot.bell.endTime)})`
                    : '—'}
                </td>
                <td className="px-3 py-2">
                  {slot.section ? `${slot.section.grade.name} ${slot.section.name}` : '—'}
                </td>
                <td className="px-3 py-2">{slot.subject?.name ?? 'Free Period'}</td>
                <td className="px-3 py-2">{slot.staff?.fullName ?? '—'}</td>
                <td className="px-3 py-2">{slot.roomLabel ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!grid.data?.slots.length ? (
          <p className="p-6 text-sm text-slate-400">No timetable entries match these filters.</p>
        ) : null}
      </div>
    </div>
  );
}
