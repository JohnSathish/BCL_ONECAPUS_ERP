'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SchoolSisTimetableGrid } from '@/components/school-sis/school-sis-timetable-grid';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchSchoolSisStaff, fetchSchoolSisTeacherTimetable } from '@/services/school-sis';

export function SchoolSisTeacherTimetable() {
  const enabled = useAuthQueryEnabled();
  const [staffId, setStaffId] = useState('');
  const staff = useQuery({ queryKey: ['school-sis-staff'], queryFn: fetchSchoolSisStaff, enabled });
  const teachers = (staff.data ?? []).filter((s) => s.staffType === 'TEACHING');
  const active = staffId || teachers[0]?.id || '';
  const grid = useQuery({
    queryKey: ['school-sis-timetable-teacher', active],
    queryFn: () => fetchSchoolSisTeacherTimetable(active),
    enabled: enabled && Boolean(active),
  });
  const name =
    grid.data?.staff?.fullName ?? teachers.find((t) => t.id === active)?.fullName ?? 'Teacher';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#1a365d]">Teacher timetable</h1>
        <p className="text-sm text-slate-500">
          Generated from class timetable assignments. Teachers are not typed in by name.
        </p>
      </div>
      <label className="block text-xs font-semibold text-slate-500">
        Teacher
        <select
          className="mt-1 h-10 min-w-[260px] rounded-lg border bg-white px-3 text-sm"
          value={active}
          onChange={(e) => setStaffId(e.target.value)}
        >
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.fullName}
            </option>
          ))}
        </select>
      </label>
      {grid.data ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <SchoolSisTimetableGrid
            grid={grid.data}
            canEdit={false}
            subjects={[]}
            staff={[]}
            queryKey={['school-sis-timetable-teacher', active]}
            mode="teacher"
            printTitle={name}
            printSub={`Academic Year: ${grid.data.academicYear.name}`}
          />
        </div>
      ) : (
        <p className="text-sm text-slate-500">Loading…</p>
      )}
    </div>
  );
}
