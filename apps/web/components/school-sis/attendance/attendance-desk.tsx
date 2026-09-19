'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchSchoolAcademicClasses, fetchSchoolAttendanceDashboard } from '@/services/school-sis';
import { AttendanceShell, AttCard, StatusChip } from './attendance-ui';
import { PrimaryButton } from '../academic/academic-ui';

function todayIso() {
  const d = new Date();
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export function AttendanceDesk() {
  const enabled = useAuthQueryEnabled();
  const [date, setDate] = useState(todayIso());
  const [gradeId, setGradeId] = useState('');
  const classes = useQuery({
    queryKey: ['school-academic-classes'],
    queryFn: fetchSchoolAcademicClasses,
    enabled,
  });
  const dash = useQuery({
    queryKey: ['school-att-dash', date, gradeId],
    queryFn: () => fetchSchoolAttendanceDashboard({ date, gradeId: gradeId || undefined }),
    enabled,
  });
  const grades = classes.data?.grades ?? [];

  const t = dash.data?.totals;
  const trendMax = Math.max(1, ...(dash.data?.trend ?? []).map((x: { value: number }) => x.value));

  return (
    <AttendanceShell
      title="Student Attendance"
      subtitle={`${dash.data?.academicYear?.name ?? ''} · ${date}`}
      extra={
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          />
          <select
            value={gradeId}
            onChange={(e) => setGradeId(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All classes</option>
            {(Array.isArray(grades) ? grades : []).map((g: { id: string; name: string }) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <Link href="/admin/school-sis/attendance/mark">
            <PrimaryButton type="button">Take attendance</PrimaryButton>
          </Link>
        </div>
      }
    >
      {dash.data?.dayKind &&
      dash.data.dayKind !== 'WORKING_DAY' &&
      dash.data.dayKind !== 'EXAMINATION' ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {date} is marked {String(dash.data.dayKind).replaceAll('_', ' ')} on the academic
          calendar. Attendance is not required unless this is a special working day.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <AttCard tone="sky" label="Total students" value={t?.students ?? '—'} />
        <AttCard tone="emerald" label="Present" value={t?.present ?? '—'} />
        <AttCard tone="rose" label="Absent" value={t?.absent ?? '—'} />
        <AttCard tone="amber" label="Late" value={t?.late ?? '—'} />
        <AttCard tone="violet" label="On leave" value={t?.leave ?? '—'} />
        <AttCard tone="cyan" label="Attendance %" value={t ? `${t.percent}%` : '—'} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-800">Attendance by class</h2>
          <div className="mt-3 space-y-2">
            {(dash.data?.byClass ?? []).map(
              (c: {
                sectionId: string;
                label: string;
                percent: number;
                status: string;
                students: number;
                absent: number;
              }) => (
                <div key={c.sectionId} className="flex items-center gap-3">
                  <Link
                    href={`/admin/school-sis/attendance/mark?sectionId=${c.sectionId}&date=${date}`}
                    className="w-28 shrink-0 text-sm font-medium text-[#1e3a8a]"
                  >
                    {c.label}
                  </Link>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#1e3a8a]"
                      style={{ width: `${Math.min(100, c.percent)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-xs text-slate-600">{c.percent}%</span>
                  <StatusChip code={c.status} />
                </div>
              ),
            )}
            {!dash.data?.byClass?.length ? (
              <p className="text-sm text-slate-500">No classes in scope for this day.</p>
            ) : null}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">14-day trend</h2>
          <div className="mt-4 flex h-36 items-end gap-1">
            {(dash.data?.trend ?? []).map((p: { name: string; value: number }) => (
              <div key={p.name} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-[#2563eb]"
                  style={{ height: `${(p.value / trendMax) * 100}%`, minHeight: p.value ? 4 : 0 }}
                  title={`${p.name}: ${p.value}%`}
                />
                <span className="text-[9px] text-slate-400">{p.name.slice(8)}</span>
              </div>
            ))}
            {!dash.data?.trend?.length ? (
              <p className="text-sm text-slate-500">No submitted attendance in this window yet.</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Missing submissions</h2>
            <span className="text-xs text-slate-500">
              {dash.data?.completion?.submitted ?? 0}/{dash.data?.completion?.total ?? 0} submitted
            </span>
          </div>
          <ul className="mt-3 space-y-1">
            {(dash.data?.completion?.missing ?? []).map(
              (c: { sectionId: string; label: string; status: string }) => (
                <li key={c.sectionId} className="flex items-center justify-between text-sm">
                  <Link
                    className="text-[#1e3a8a]"
                    href={`/admin/school-sis/attendance/mark?sectionId=${c.sectionId}&date=${date}`}
                  >
                    {c.label}
                  </Link>
                  <StatusChip code={c.status} />
                </li>
              ),
            )}
            {!dash.data?.completion?.missing?.length ? (
              <p className="text-sm text-slate-500">
                All classes have submitted today’s attendance.
              </p>
            ) : null}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Low attendance</h2>
          <ul className="mt-3 space-y-2">
            {(dash.data?.lowAttendance ?? [])
              .slice(0, 8)
              .map(
                (s: {
                  studentId: string;
                  fullName: string;
                  className: string;
                  percent: number;
                  band: string;
                }) => (
                  <li key={s.studentId} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {s.fullName}
                      <span className="ml-2 text-xs text-slate-500">{s.className}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">{s.percent}%</span>
                      <StatusChip code={s.band} />
                    </span>
                  </li>
                ),
              )}
            {!dash.data?.lowAttendance?.length ? (
              <p className="text-sm text-slate-500">No students below the school threshold.</p>
            ) : null}
          </ul>
        </div>
      </div>
    </AttendanceShell>
  );
}
