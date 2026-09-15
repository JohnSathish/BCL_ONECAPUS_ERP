'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  archiveSchoolExam,
  fetchSchoolAcademicClasses,
  fetchSchoolExamDashboard,
  fetchSchoolExamTypes,
  saveSchoolExam,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { ExamBadge, ExamCard, ExamShell, examField, fmtDate, num } from './exams-ui';
import { PrimaryButton, GhostButton } from '../academic/academic-ui';

const STATUSES = [
  'DRAFT',
  'SCHEDULED',
  'ONGOING',
  'MARKS_ENTRY',
  'UNDER_REVIEW',
  'EVALUATION_COMPLETE',
  'RESULT_GENERATED',
  'PUBLISHED',
  'ARCHIVED',
];

export function ExaminationDesk() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const dash = useQuery({
    queryKey: ['school-exams-dash'],
    queryFn: fetchSchoolExamDashboard,
    enabled,
  });
  const types = useQuery({
    queryKey: ['school-exam-types'],
    queryFn: fetchSchoolExamTypes,
    enabled,
  });
  const classes = useQuery({
    queryKey: ['school-academic-classes'],
    queryFn: fetchSchoolAcademicClasses,
    enabled,
  });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    typeId: '',
    startDate: '',
    endDate: '',
    description: '',
    status: 'DRAFT',
    gradeIds: [] as string[],
    marksDeadline: '',
  });

  const cards = useMemo(
    () => [
      { label: 'Upcoming Exams', value: dash.data?.upcoming ?? 0 },
      { label: 'Ongoing Exams', value: dash.data?.ongoing ?? 0 },
      { label: 'Completed Exams', value: dash.data?.completed ?? 0 },
      { label: 'Marks Pending', value: dash.data?.marksPending ?? 0 },
      { label: 'Results Published', value: dash.data?.resultsPublished ?? 0 },
      { label: 'Students Appeared', value: dash.data?.studentsAppeared ?? 0 },
      { label: 'Students Passed', value: dash.data?.studentsPassed ?? 0 },
      { label: 'Students Failed', value: dash.data?.studentsFailed ?? 0 },
    ],
    [dash.data],
  );

  const create = useMutation({
    mutationFn: () =>
      saveSchoolExam({
        ...form,
        typeId: form.typeId || types.data?.[0]?.id,
        gradeIds: form.gradeIds,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        marksDeadline: form.marksDeadline || undefined,
      }),
    onSuccess: () => {
      setOpen(false);
      setError(null);
      setForm({
        name: '',
        typeId: '',
        startDate: '',
        endDate: '',
        description: '',
        status: 'DRAFT',
        gradeIds: [],
        marksDeadline: '',
      });
      void qc.invalidateQueries({ queryKey: ['school-exams-dash'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const archive = useMutation({
    mutationFn: (id: string) => archiveSchoolExam(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['school-exams-dash'] }),
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <ExamShell
      title="Examination"
      subtitle="Manage examinations, schedules, marks, results and report cards."
      extra={
        canManage ? (
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={() => setOpen(true)}>Create Examination</PrimaryButton>
            <Link
              href="/admin/school-sis/exams/schedule"
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
            >
              Schedule Exam
            </Link>
            <Link
              href="/admin/school-sis/exams/marks"
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
            >
              Enter Marks
            </Link>
            <Link
              href="/admin/school-sis/exams/results"
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
            >
              View Results
            </Link>
            <Link
              href="/admin/school-sis/exams/report-cards"
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
            >
              Report Cards
            </Link>
          </div>
        ) : null
      }
    >
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <ExamCard key={c.label}>
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold text-[#1e3a8a]">{c.value}</p>
          </ExamCard>
        ))}
      </div>

      {open ? (
        <ExamCard>
          <p className="mb-3 font-semibold text-[#1e3a8a]">Create Examination</p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-medium text-slate-600">
              Exam Name
              <input
                className={`${examField} mt-1`}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Exam Type
              <select
                className={`${examField} mt-1`}
                value={form.typeId}
                onChange={(e) => setForm({ ...form, typeId: e.target.value })}
              >
                <option value="">Select type</option>
                {(types.data ?? []).map((t: { id: string; name: string }) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Start Date
              <input
                type="date"
                className={`${examField} mt-1`}
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              End Date
              <input
                type="date"
                className={`${examField} mt-1`}
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Status
              <select
                className={`${examField} mt-1`}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Marks deadline
              <input
                type="date"
                className={`${examField} mt-1`}
                value={form.marksDeadline}
                onChange={(e) => setForm({ ...form, marksDeadline: e.target.value })}
              />
            </label>
            <label className="md:col-span-2 text-xs font-medium text-slate-600">
              Applicable classes
              <div className="mt-2 flex flex-wrap gap-2">
                {(classes.data?.grades ?? []).map((g: { id: string; name: string }) => {
                  const on = form.gradeIds.includes(g.id);
                  return (
                    <button
                      type="button"
                      key={g.id}
                      onClick={() =>
                        setForm({
                          ...form,
                          gradeIds: on
                            ? form.gradeIds.filter((id) => id !== g.id)
                            : [...form.gradeIds, g.id],
                        })
                      }
                      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${on ? 'bg-[#2563eb] text-white ring-[#2563eb]' : 'bg-white text-slate-600 ring-slate-200'}`}
                    >
                      {g.name}
                    </button>
                  );
                })}
              </div>
            </label>
            <label className="md:col-span-2 text-xs font-medium text-slate-600">
              Description
              <textarea
                className="mt-1 min-h-[80px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <PrimaryButton
              disabled={!form.name || create.isPending}
              onClick={() => create.mutate()}
            >
              Save examination
            </PrimaryButton>
            <GhostButton onClick={() => setOpen(false)}>Cancel</GhostButton>
          </div>
        </ExamCard>
      ) : null}

      <ExamCard>
        <p className="mb-3 font-semibold text-[#1e3a8a]">Upcoming Examinations</p>
        <div className="space-y-2">
          {(dash.data?.upcomingList ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">
              No upcoming examinations in the current academic year.
            </p>
          ) : (
            (dash.data.upcomingList as any[]).map((exam) => (
              <Link
                key={exam.id}
                href={`/admin/school-sis/exams/${exam.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium text-slate-800">{exam.name}</p>
                  <p className="text-xs text-slate-500">
                    {exam.type?.name} · {fmtDate(exam.startDate)} – {fmtDate(exam.endDate)}
                  </p>
                </div>
                <ExamBadge value={exam.status} />
              </Link>
            ))
          )}
        </div>
      </ExamCard>

      <ExamCard>
        <p className="mb-3 font-semibold text-[#1e3a8a]">All examinations</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2">Exam</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Dates</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Records</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(dash.data?.exams ?? []).map((exam: any) => (
                <tr key={exam.id} className="border-t border-slate-100">
                  <td className="px-2 py-2 font-medium">
                    <Link
                      className="text-[#2563eb] hover:underline"
                      href={`/admin/school-sis/exams/${exam.id}`}
                    >
                      {exam.name}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{exam.type?.name}</td>
                  <td className="px-2 py-2 text-slate-500">
                    {fmtDate(exam.startDate)} – {fmtDate(exam.endDate)}
                  </td>
                  <td className="px-2 py-2">
                    <ExamBadge value={exam.status} />
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-500">
                    {num(exam._count?.schedules)} schedules · {num(exam._count?.marks)} marks ·{' '}
                    {num(exam._count?.results)} results
                  </td>
                  <td className="px-2 py-2 text-right">
                    {canManage ? (
                      <GhostButton
                        onClick={() => {
                          if (
                            confirm(
                              'Archive this examination? Examinations with marks cannot be permanently deleted.',
                            )
                          )
                            archive.mutate(exam.id);
                        }}
                      >
                        Archive
                      </GhostButton>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ExamCard>
    </ExamShell>
  );
}
