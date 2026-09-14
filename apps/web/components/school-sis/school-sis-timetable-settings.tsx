'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TIMETABLE_DAYS } from '@/components/school-sis/school-sis-timetable-grid';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  createSchoolSisRoom,
  deleteSchoolSisRoom,
  fetchSchoolSisTimetableSetup,
  saveSchoolSisTimetableBells,
  type SchoolSisTimetableBell,
} from '@/services/school-sis';
import { TimetableChrome } from '@/components/school-sis/timetable/tt-chrome';

export function SchoolSisTimetableSettings() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const canEdit = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const [error, setError] = useState<string | null>(null);
  const [bells, setBells] = useState<SchoolSisTimetableBell[]>([]);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [roomName, setRoomName] = useState('');

  const setup = useQuery({
    queryKey: ['school-sis-timetable-setup'],
    queryFn: fetchSchoolSisTimetableSetup,
    enabled,
  });

  useEffect(() => {
    if (setup.data?.bells) setBells(setup.data.bells);
    if (setup.data?.days) setDays(setup.data.days);
  }, [setup.data]);

  const save = useMutation({
    mutationFn: () =>
      saveSchoolSisTimetableBells({
        academicYearId: setup.data?.academicYear.id,
        days,
        bells: bells.map((b, i) => ({
          id: b.id,
          kind: b.kind,
          code: b.code,
          label: b.label,
          startTime: b.startTime,
          endTime: b.endTime,
          sortOrder: i + 1,
          periodNumber: b.kind === 'PERIOD' ? b.periodNumber : null,
        })),
      }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['school-sis-timetable-setup'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const addRoom = useMutation({
    mutationFn: () => createSchoolSisRoom(roomName),
    onSuccess: () => {
      setRoomName('');
      void qc.invalidateQueries({ queryKey: ['school-sis-timetable-setup'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const updateBell = (id: string, patch: Partial<SchoolSisTimetableBell>) => {
    setBells((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  return (
    <TimetableChrome
      title="Period configuration"
      hint="1st–7th periods plus Short Break and Lunch/Break. Changing times here does not delete class entries."
    >
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1a365d]">School days</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {TIMETABLE_DAYS.map((d) => (
            <label key={d.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={days.includes(d.id)}
                onChange={(e) =>
                  setDays((prev) =>
                    e.target.checked ? [...prev, d.id].sort() : prev.filter((x) => x !== d.id),
                  )
                }
              />
              {d.full}
            </label>
          ))}
        </div>
      </section>

      <section className="overflow-x-auto rounded-2xl border bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1a365d]">Periods and breaks</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="py-2">Type</th>
              <th>Code</th>
              <th>Label</th>
              <th>Start</th>
              <th>End</th>
            </tr>
          </thead>
          <tbody>
            {bells.map((bell) => (
              <tr key={bell.id} className="border-t">
                <td className="py-2">
                  <select
                    className="h-9 rounded border px-2"
                    disabled={!canEdit}
                    value={bell.kind}
                    onChange={(e) =>
                      updateBell(bell.id, { kind: e.target.value as 'PERIOD' | 'BREAK' })
                    }
                  >
                    <option value="PERIOD">Period</option>
                    <option value="BREAK">Break</option>
                  </select>
                </td>
                <td>
                  <input
                    className="h-9 w-20 rounded border px-2"
                    disabled={!canEdit}
                    value={bell.code}
                    onChange={(e) => updateBell(bell.id, { code: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="h-9 w-48 rounded border px-2"
                    disabled={!canEdit}
                    value={bell.label}
                    onChange={(e) => updateBell(bell.id, { label: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="h-9 w-24 rounded border px-2"
                    disabled={!canEdit}
                    value={bell.startTime}
                    onChange={(e) => updateBell(bell.id, { startTime: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="h-9 w-24 rounded border px-2"
                    disabled={!canEdit}
                    value={bell.endTime}
                    onChange={(e) => updateBell(bell.id, { endTime: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {canEdit ? (
          <button
            type="button"
            className="mt-4 rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            Save bell schedule
          </button>
        ) : null}
      </section>

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1a365d]">Rooms</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(setup.data?.rooms ?? []).map((room) => (
            <li
              key={room.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              {room.name}
              {canEdit ? (
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() =>
                    deleteSchoolSisRoom(room.id).then(() =>
                      qc.invalidateQueries({ queryKey: ['school-sis-timetable-setup'] }),
                    )
                  }
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {canEdit ? (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (roomName.trim()) addRoom.mutate();
            }}
          >
            <input
              className="h-10 rounded-lg border px-3 text-sm"
              placeholder="Room 5A"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
            <button type="submit" className="h-10 rounded-xl border px-3 text-sm">
              Add room
            </button>
          </form>
        ) : null}
      </section>
    </TimetableChrome>
  );
}
