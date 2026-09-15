'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  fetchSchoolExam,
  saveSchoolExam,
  saveSchoolExamComponent,
  saveSchoolExamSubject,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { ExamBadge, ExamCard, ExamShell, examField, fmtDate, num } from './exams-ui';
import { GhostButton, PrimaryButton } from '../academic/academic-ui';

export function ExamEditorDesk({ examId }: { examId: string }) {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const exam = useQuery({
    queryKey: ['school-exam', examId],
    queryFn: () => fetchSchoolExam(examId),
    enabled: enabled && Boolean(examId),
  });
  const [error, setError] = useState<string | null>(null);
  const [comp, setComp] = useState({
    examSubjectId: '',
    name: '',
    code: '',
    maxMarks: 10,
    passMarks: 0,
    weightage: 100,
  });

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) => saveSchoolExam(payload, examId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['school-exam', examId] }),
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const saveSub = useMutation({
    mutationFn: (payload: Record<string, unknown>) => saveSchoolExamSubject(examId, payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['school-exam', examId] }),
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const saveComp = useMutation({
    mutationFn: () =>
      saveSchoolExamComponent(comp.examSubjectId, {
        name: comp.name,
        code: comp.code,
        maxMarks: Number(comp.maxMarks),
        passMarks: Number(comp.passMarks),
        weightage: Number(comp.weightage),
      }),
    onSuccess: () => {
      setComp({ ...comp, name: '', code: '' });
      void qc.invalidateQueries({ queryKey: ['school-exam', examId] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const row = exam.data as any;
  const subjects = (row?.subjects ?? []) as any[];

  return (
    <ExamShell
      title={row?.name ?? 'Examination'}
      subtitle={`${row?.type?.name ?? ''} · ${fmtDate(row?.startDate)} – ${fmtDate(row?.endDate)}`}
      extra={row ? <ExamBadge value={row.status} /> : null}
    >
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      {exam.isLoading ? <p className="text-sm text-slate-500">Loading examination…</p> : null}
      {!exam.isLoading && !row ? (
        <p className="text-sm text-slate-500">Examination not found.</p>
      ) : null}
      {row ? (
        <>
          <ExamCard>
            <p className="mb-2 text-sm text-slate-600">
              {row.description ||
                'Configure subjects and assessment components for this examination. Seeded from class subjects; adjust maxima and weightage to match school norms.'}
            </p>
            {canManage ? (
              <div className="flex flex-wrap gap-2">
                {[
                  'DRAFT',
                  'SCHEDULED',
                  'ONGOING',
                  'MARKS_ENTRY',
                  'UNDER_REVIEW',
                  'EVALUATION_COMPLETE',
                  'RESULT_GENERATED',
                  'PUBLISHED',
                  'ARCHIVED',
                ].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                    onClick={() => save.mutate({ name: row.name, typeId: row.typeId, status: s })}
                  >
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            ) : null}
          </ExamCard>
          <ExamCard>
            <p className="mb-3 font-semibold text-[#1e3a8a]">Exam structure</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Class</th>
                    <th className="px-2 py-2">Subject</th>
                    <th className="px-2 py-2">Max</th>
                    <th className="px-2 py-2">Pass</th>
                    <th className="px-2 py-2">Weightage</th>
                    <th className="px-2 py-2">Components</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => (
                    <tr key={s.id} className="border-t border-slate-100 align-top">
                      <td className="px-2 py-2">{s.grade?.name}</td>
                      <td className="px-2 py-2 font-medium">{s.subject?.name}</td>
                      <td className="px-2 py-2">
                        <input
                          className={`${examField} w-20`}
                          defaultValue={num(s.maxTotal)}
                          onBlur={(e) =>
                            canManage &&
                            saveSub.mutate({
                              gradeId: s.gradeId,
                              subjectId: s.subjectId,
                              maxTotal: Number(e.target.value),
                              passTotal: num(s.passTotal),
                              weightage: num(s.weightage),
                              requireTheoryPass: s.requireTheoryPass,
                              theoryMax: num(s.theoryMax),
                              theoryPass: num(s.theoryPass),
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={`${examField} w-20`}
                          defaultValue={num(s.passTotal)}
                          onBlur={(e) =>
                            canManage &&
                            saveSub.mutate({
                              gradeId: s.gradeId,
                              subjectId: s.subjectId,
                              maxTotal: num(s.maxTotal),
                              passTotal: Number(e.target.value),
                              weightage: num(s.weightage),
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">{num(s.weightage)}%</td>
                      <td className="px-2 py-2">
                        <ul className="space-y-1 text-xs text-slate-600">
                          {(s.components ?? []).map((c: any) => (
                            <li key={c.id}>
                              {c.name} ({c.code}) · max {num(c.maxMarks)} · pass {num(c.passMarks)}{' '}
                              · {num(c.weightage)}%
                            </li>
                          ))}
                        </ul>
                        {canManage ? (
                          <button
                            type="button"
                            className="mt-1 text-xs font-semibold text-[#2563eb]"
                            onClick={() => setComp({ ...comp, examSubjectId: s.id })}
                          >
                            + Component
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canManage && comp.examSubjectId ? (
              <div className="mt-3 grid gap-2 md:grid-cols-5">
                <input
                  className={examField}
                  placeholder="Name (Theory / Oral / Project)"
                  value={comp.name}
                  onChange={(e) => setComp({ ...comp, name: e.target.value })}
                />
                <input
                  className={examField}
                  placeholder="Code"
                  value={comp.code}
                  onChange={(e) => setComp({ ...comp, code: e.target.value })}
                />
                <input
                  className={examField}
                  type="number"
                  placeholder="Max"
                  value={comp.maxMarks}
                  onChange={(e) => setComp({ ...comp, maxMarks: Number(e.target.value) })}
                />
                <input
                  className={examField}
                  type="number"
                  placeholder="Pass"
                  value={comp.passMarks}
                  onChange={(e) => setComp({ ...comp, passMarks: Number(e.target.value) })}
                />
                <PrimaryButton
                  disabled={!comp.name || !comp.code}
                  onClick={() => saveComp.mutate()}
                >
                  Add component
                </PrimaryButton>
              </div>
            ) : null}
          </ExamCard>
          <ExamCard>
            <p className="mb-2 font-semibold text-[#1e3a8a]">Timetable</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Class</th>
                    <th className="px-2 py-2">Subject</th>
                    <th className="px-2 py-2">Time</th>
                    <th className="px-2 py-2">Room</th>
                    <th className="px-2 py-2">Invigilator</th>
                  </tr>
                </thead>
                <tbody>
                  {(row.schedules ?? []).map((s: any) => (
                    <tr key={s.id} className="border-t border-slate-100">
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
                        {(s.invigilators ?? []).map((i: any) => i.staff?.fullName).join(', ') ||
                          '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <GhostButton className="mt-3" onClick={() => window.print()}>
              Print timetable
            </GhostButton>
          </ExamCard>
        </>
      ) : null}
    </ExamShell>
  );
}
