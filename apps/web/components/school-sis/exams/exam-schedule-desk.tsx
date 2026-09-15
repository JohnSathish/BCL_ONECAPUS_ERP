'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  fetchSchoolAcademicClasses,
  fetchSchoolExam,
  fetchSchoolExamSchedules,
  fetchSchoolExams,
  fetchSchoolSisStaff,
  saveSchoolExamSchedule,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { ExamCard, ExamShell, examField, fmtDate } from './exams-ui';
import { PrimaryButton } from '../academic/academic-ui';

export function ExamScheduleDesk() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const exams = useQuery({ queryKey: ['school-exams'], queryFn: fetchSchoolExams, enabled });
  const [examId, setExamId] = useState('');
  const schedules = useQuery({
    queryKey: ['school-exam-schedules', examId],
    queryFn: () => fetchSchoolExamSchedules(examId || undefined),
    enabled,
  });
  const detail = useQuery({
    queryKey: ['school-exam', examId],
    queryFn: () => fetchSchoolExam(examId),
    enabled: enabled && Boolean(examId),
  });
  const classes = useQuery({
    queryKey: ['school-academic-classes'],
    queryFn: fetchSchoolAcademicClasses,
    enabled,
  });
  const staff = useQuery({
    queryKey: ['school-sis-staff'],
    queryFn: fetchSchoolSisStaff,
    enabled: enabled && canManage,
  });
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [error, setError] = useState<string | null>(null);
  const [override, setOverride] = useState(false);
  const [form, setForm] = useState({
    sectionId: '',
    subjectId: '',
    examDate: '',
    startTime: '09:00',
    endTime: '11:00',
    durationMin: 120,
    room: '',
    invigilatorId: '',
    instructions: '',
  });

  const subjects = useMemo(() => {
    const list = ((detail.data as any)?.subjects ?? []) as any[];
    const map = new Map<string, { id: string; name: string }>();
    for (const s of list) map.set(s.subjectId, { id: s.subjectId, name: s.subject?.name });
    return [...map.values()];
  }, [detail.data]);

  const save = useMutation({
    mutationFn: () =>
      saveSchoolExamSchedule({
        examId,
        ...form,
        durationMin: Number(form.durationMin),
        invigilatorId: form.invigilatorId || undefined,
        overrideConflict: override,
      }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['school-exam-schedules'] });
      void qc.invalidateQueries({ queryKey: ['school-exam', examId] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const rows = (schedules.data ?? []) as any[];
  const byDate = useMemo(() => {
    const g = new Map<string, any[]>();
    for (const r of rows) {
      const k = String(r.examDate).slice(0, 10);
      g.set(k, [...(g.get(k) ?? []), r]);
    }
    return [...g.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  return (
    <ExamShell
      title="Exam Schedule"
      subtitle="Timetable, rooms and invigilators with overlap protection."
    >
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      <ExamCard>
        <div className="flex flex-wrap gap-3">
          <label className="text-xs font-medium text-slate-600">
            Examination
            <select
              className={`${examField} mt-1 min-w-[240px]`}
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
            >
              <option value="">All examinations</option>
              {(exams.data ?? []).map((e: any) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              className={`h-10 rounded-lg px-3 text-sm ${view === 'list' ? 'bg-[#2563eb] text-white' : 'bg-white ring-1 ring-slate-200'}`}
              onClick={() => setView('list')}
            >
              List
            </button>
            <button
              type="button"
              className={`h-10 rounded-lg px-3 text-sm ${view === 'calendar' ? 'bg-[#2563eb] text-white' : 'bg-white ring-1 ring-slate-200'}`}
              onClick={() => setView('calendar')}
            >
              Calendar
            </button>
            <button
              type="button"
              className="h-10 rounded-lg bg-white px-3 text-sm ring-1 ring-slate-200"
              onClick={() => window.print()}
            >
              Print timetable
            </button>
          </div>
        </div>
      </ExamCard>

      {canManage && examId ? (
        <ExamCard>
          <p className="mb-3 font-semibold text-[#1e3a8a]">Add schedule</p>
          <div className="grid gap-3 md:grid-cols-3">
            <select
              className={examField}
              value={form.sectionId}
              onChange={(e) => setForm({ ...form, sectionId: e.target.value })}
            >
              <option value="">Section</option>
              {(classes.data?.sections ?? []).map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.grade?.name} {s.name}
                </option>
              ))}
            </select>
            <select
              className={examField}
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
            >
              <option value="">Subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              className={examField}
              value={form.examDate}
              onChange={(e) => setForm({ ...form, examDate: e.target.value })}
            />
            <input
              className={examField}
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
            <input
              className={examField}
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
            <input
              className={examField}
              placeholder="Room"
              value={form.room}
              onChange={(e) => setForm({ ...form, room: e.target.value })}
            />
            <select
              className={examField}
              value={form.invigilatorId}
              onChange={(e) => setForm({ ...form, invigilatorId: e.target.value })}
            >
              <option value="">Invigilator</option>
              {(staff.data ?? []).map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
            <input
              className={examField}
              placeholder="Instructions"
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={override}
                onChange={(e) => setOverride(e.target.checked)}
              />
              Override invigilator conflict
            </label>
          </div>
          <PrimaryButton
            className="mt-3"
            disabled={!form.sectionId || !form.subjectId || !form.examDate}
            onClick={() => save.mutate()}
          >
            Add schedule
          </PrimaryButton>
        </ExamCard>
      ) : null}

      {view === 'list' ? (
        <ExamCard>
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2">Exam</th>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Class</th>
                <th className="px-2 py-2">Subject</th>
                <th className="px-2 py-2">Time</th>
                <th className="px-2 py-2">Room</th>
                <th className="px-2 py-2">Invigilator</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-2 py-2">{s.exam?.name}</td>
                  <td className="px-2 py-2">{fmtDate(s.examDate)}</td>
                  <td className="px-2 py-2">
                    {s.section?.grade?.name} {s.section?.name}
                  </td>
                  <td className="px-2 py-2">{s.subject?.name}</td>
                  <td className="px-2 py-2">
                    {s.startTime} – {s.endTime}
                  </td>
                  <td className="px-2 py-2">{s.room || '—'}</td>
                  <td className="px-2 py-2">
                    {(s.invigilators ?? []).map((i: any) => i.staff?.fullName).join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ExamCard>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {byDate.map(([date, items]) => (
            <ExamCard key={date}>
              <p className="mb-2 font-semibold text-[#1e3a8a]">{fmtDate(date)}</p>
              {items.map((s) => (
                <p key={s.id} className="text-sm text-slate-700">
                  {s.startTime} {s.subject?.name} · {s.section?.grade?.name} {s.section?.name} ·{' '}
                  {s.room || 'Room TBC'}
                </p>
              ))}
            </ExamCard>
          ))}
        </div>
      )}
    </ExamShell>
  );
}
