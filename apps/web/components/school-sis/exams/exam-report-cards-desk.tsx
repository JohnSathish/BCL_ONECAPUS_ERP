'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchSchoolAcademicClasses,
  fetchSchoolExamReportCard,
  fetchSchoolExamResults,
  fetchSchoolExams,
  fetchSchoolExamSettings,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { ExamCard, ExamShell, examField, fmtDate, num } from './exams-ui';
import { GhostButton, PrimaryButton } from '../academic/academic-ui';
import { SCHOOL_SIS_LOGO_SRC } from '@/lib/school-erp/product';

export function ExamReportCardsDesk() {
  const enabled = useAuthQueryEnabled();
  const exams = useQuery({ queryKey: ['school-exams'], queryFn: fetchSchoolExams, enabled });
  const settings = useQuery({
    queryKey: ['school-exam-settings'],
    queryFn: fetchSchoolExamSettings,
    enabled,
  });
  const classes = useQuery({
    queryKey: ['school-academic-classes'],
    queryFn: fetchSchoolAcademicClasses,
    enabled,
  });
  const [examId, setExamId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const results = useQuery({
    queryKey: ['school-exam-results', examId, sectionId],
    queryFn: () => fetchSchoolExamResults(examId, sectionId || undefined),
    enabled: enabled && Boolean(examId),
  });
  const card = useQuery({
    queryKey: ['school-exam-card', examId, studentId],
    queryFn: () => fetchSchoolExamReportCard(examId, studentId),
    enabled: enabled && Boolean(examId) && Boolean(studentId),
  });

  const row = card.data as any;
  const ranking = settings.data?.rankingEnabled && settings.data?.showRankOnCard;
  const showPhoto = settings.data?.showPhotoOnCard;

  return (
    <ExamShell
      title="Report Cards"
      subtitle="Generate printable A4 report cards from published or generated results."
    >
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      <ExamCard>
        <div className="grid gap-3 md:grid-cols-4">
          <select
            className={examField}
            value={examId}
            onChange={(e) => {
              setExamId(e.target.value);
              setStudentId('');
            }}
          >
            <option value="">Examination</option>
            {(exams.data ?? []).map((e: any) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <select
            className={examField}
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          >
            <option value="">All sections</option>
            {(classes.data?.sections ?? []).map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.grade?.name} {s.name}
              </option>
            ))}
          </select>
          <select
            className={examField}
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            <option value="">Student</option>
            {(results.data?.rows ?? []).map((r: any) => (
              <option key={r.studentId} value={r.studentId}>
                {r.student?.fullName}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <PrimaryButton
              onClick={() => {
                if (!studentId)
                  setError('Select a student, or print the class after choosing a section.');
                else window.print();
              }}
            >
              Print
            </PrimaryButton>
            <GhostButton onClick={() => window.print()}>Download PDF</GhostButton>
          </div>
        </div>
      </ExamCard>

      {card.isError ? <p className="text-sm text-rose-700">{apiErrorMessage(card.error)}</p> : null}

      {row?.result ? (
        <div className="print:block">
          <div className="mx-auto max-w-[210mm] rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
            <div className="flex items-start gap-4 border-b border-slate-200 pb-4">
              <img src={SCHOOL_SIS_LOGO_SRC} alt="" className="h-16 w-16 object-contain" />
              <div className="flex-1 text-center">
                <h2 className="text-xl font-semibold text-[#1e3a8a]">
                  St. Luke&apos;s Secondary School
                </h2>
                <p className="text-xs text-slate-500">
                  Tura · Academic Year {row.exam?.academicYear?.name}
                </p>
                <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-slate-700">
                  {row.exam?.name} · Report Card
                </p>
              </div>
              {showPhoto ? (
                <div className="h-16 w-14 rounded border border-dashed border-slate-300 text-[10px] text-slate-400 flex items-center justify-center">
                  Photo
                </div>
              ) : null}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <p>
                <span className="text-slate-500">Student:</span> {row.result.student?.fullName}
              </p>
              <p>
                <span className="text-slate-500">Admission No:</span>{' '}
                {row.result.student?.admissionNumber}
              </p>
              <p>
                <span className="text-slate-500">Examination:</span> {row.exam?.name}
              </p>
              <p>
                <span className="text-slate-500">Date:</span> {fmtDate(row.exam?.endDate)}
              </p>
            </div>
            <table className="mt-4 min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-2">Subject</th>
                  <th className="px-2 py-2">Max</th>
                  <th className="px-2 py-2">Marks</th>
                  <th className="px-2 py-2">%</th>
                  <th className="px-2 py-2">Grade</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(row.result.subjects ?? []).map((s: any) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-2 py-1.5">{s.subject?.name}</td>
                    <td className="px-2 py-1.5">{num(s.max)}</td>
                    <td className="px-2 py-1.5">{num(s.obtained)}</td>
                    <td className="px-2 py-1.5">{num(s.percent)}</td>
                    <td className="px-2 py-1.5">{s.grade}</td>
                    <td className="px-2 py-1.5">{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <p>
                Total:{' '}
                <strong>
                  {num(row.result.totalObtained)}/{num(row.result.totalMax)}
                </strong>
              </p>
              <p>
                Percentage: <strong>{num(row.result.percent)}%</strong>
              </p>
              <p>
                Overall grade: <strong>{row.result.grade}</strong>
              </p>
              <p>
                Result: <strong>{row.result.status}</strong>
              </p>
              {ranking ? (
                <p>
                  Rank: <strong>{row.result.rankSection ?? row.result.rankClass ?? '—'}</strong>
                </p>
              ) : null}
              {num(row.result.graceApplied) ? (
                <p>Grace marks: {num(row.result.graceApplied)}</p>
              ) : null}
            </div>
            <p className="mt-4 text-sm text-slate-600">Remarks: {row.result.remarks || '—'}</p>
            <p className="mt-2 text-xs text-slate-400">
              Attendance is shown when the attendance register is published for this year.
            </p>
            <div className="mt-10 grid grid-cols-3 gap-6 text-center text-xs text-slate-500">
              <p className="border-t border-slate-300 pt-2">Class teacher</p>
              <p className="border-t border-slate-300 pt-2">Principal</p>
              <p className="border-t border-slate-300 pt-2">School seal</p>
            </div>
          </div>
        </div>
      ) : (
        <ExamCard>
          <p className="text-sm text-slate-500">
            Select an examination and student to preview the report card. Use Print for A4 output.
          </p>
        </ExamCard>
      )}
    </ExamShell>
  );
}
