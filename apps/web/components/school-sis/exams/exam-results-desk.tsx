'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  fetchSchoolAcademicClasses,
  fetchSchoolExamReports,
  fetchSchoolExamResults,
  fetchSchoolExams,
  generateSchoolExamResults,
  publishSchoolExamResults,
  unpublishSchoolExamResults,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { ExamBadge, ExamCard, ExamShell, examField, num } from './exams-ui';
import { GhostButton, PrimaryButton } from '../academic/academic-ui';

export function ExamResultsDesk() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const exams = useQuery({ queryKey: ['school-exams'], queryFn: fetchSchoolExams, enabled });
  const classes = useQuery({
    queryKey: ['school-academic-classes'],
    queryFn: fetchSchoolAcademicClasses,
    enabled,
  });
  const [examId, setExamId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [status, setStatus] = useState('');
  const [studentQ, setStudentQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const results = useQuery({
    queryKey: ['school-exam-results', examId, sectionId],
    queryFn: () => fetchSchoolExamResults(examId, sectionId || undefined),
    enabled: enabled && Boolean(examId),
  });
  const reports = useQuery({
    queryKey: ['school-exam-reports', examId],
    queryFn: () => fetchSchoolExamReports(examId),
    enabled: enabled && Boolean(examId),
  });

  const generate = useMutation({
    mutationFn: () => generateSchoolExamResults({ examId, sectionId: sectionId || undefined }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['school-exam-results'] });
      void qc.invalidateQueries({ queryKey: ['school-exam-reports'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const publish = useMutation({
    mutationFn: () => publishSchoolExamResults(examId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['school-exams'] }),
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const unpublish = useMutation({
    mutationFn: () => {
      const reason =
        prompt('This will make the result unavailable to students and parents. Reason?') || '';
      return unpublishSchoolExamResults(examId, reason);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['school-exams'] }),
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const rankingEnabled = results.data?.rankingEnabled !== false;
  const rows = useMemo(() => {
    let list = (results.data?.rows ?? []) as any[];
    if (status) list = list.filter((r) => r.status === status);
    if (studentQ.trim()) {
      const q = studentQ.toLowerCase();
      list = list.filter(
        (r) =>
          String(r.student?.fullName ?? '')
            .toLowerCase()
            .includes(q) ||
          String(r.student?.admissionNumber ?? '')
            .toLowerCase()
            .includes(q),
      );
    }
    return list;
  }, [results.data, status, studentQ]);

  const summary = results.data?.summary ?? {
    students: 0,
    passed: 0,
    failed: 0,
    absent: 0,
    withheld: 0,
  };
  const passPct = summary.students ? ((summary.passed / summary.students) * 100).toFixed(1) : '0.0';
  const dist = reports.data?.gradeDistribution ?? [];
  const distTotal = dist.reduce((s: number, d: any) => s + d.count, 0) || 1;

  function exportCsv() {
    const header = ['Rank', 'Roll', 'Student', 'Total', 'Percentage', 'Grade', 'Result'];
    const body = rows.map((r) =>
      [
        rankingEnabled ? (r.rankSection ?? r.rankClass ?? '') : '',
        r.student?.enrollments?.[0]?.rollNumber ?? '',
        r.student?.fullName,
        `${num(r.totalObtained)}/${num(r.totalMax)}`,
        num(r.percent),
        r.grade ?? '',
        r.status,
      ].join(','),
    );
    const blob = new Blob([[header.join(','), ...body].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'class-result.csv';
    a.click();
  }

  return (
    <ExamShell
      title="Results"
      subtitle="Generate, review and publish results. Unpublished results stay hidden from students and parents."
      extra={
        canManage ? (
          <div className="flex flex-wrap gap-2">
            <PrimaryButton
              disabled={!examId || generate.isPending}
              onClick={() => generate.mutate()}
            >
              Generate results
            </PrimaryButton>
            <GhostButton
              disabled={!examId}
              onClick={() => {
                if (
                  confirm('Publish results to students and parents? Marks will become read-only.')
                )
                  publish.mutate();
              }}
            >
              Publish
            </GhostButton>
            <GhostButton disabled={!examId} onClick={() => unpublish.mutate()}>
              Unpublish
            </GhostButton>
            <Link
              href="/admin/school-sis/academic/promotion"
              className="inline-flex h-10 items-center rounded-lg bg-white px-3 text-sm font-medium ring-1 ring-slate-200"
            >
              Promotion
            </Link>
          </div>
        ) : null
      }
    >
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      <ExamCard>
        <div className="grid gap-3 md:grid-cols-5">
          <select className={examField} value={examId} onChange={(e) => setExamId(e.target.value)}>
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
          <select className={examField} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {['PASS', 'FAIL', 'ABSENT', 'WITHHELD', 'INCOMPLETE', 'COMPARTMENT', 'EXEMPTED'].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
          <input
            className={examField}
            placeholder="Student"
            value={studentQ}
            onChange={(e) => setStudentQ(e.target.value)}
          />
          <GhostButton onClick={exportCsv}>Export Excel</GhostButton>
        </div>
      </ExamCard>

      {examId ? (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['Students', summary.students],
            ['Passed', summary.passed],
            ['Failed', summary.failed],
            ['Absent', summary.absent],
            ['Withheld', summary.withheld],
            ['Pass %', `${passPct}%`],
          ].map(([l, v]) => (
            <ExamCard key={String(l)}>
              <p className="text-xs text-slate-500">{l}</p>
              <p className="text-xl font-semibold text-[#1e3a8a]">{v}</p>
            </ExamCard>
          ))}
        </div>
      ) : null}

      {examId ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <ExamCard>
            <p className="mb-2 font-semibold text-[#1e3a8a]">Grade distribution</p>
            <div className="space-y-2">
              {dist.map((d: any) => (
                <div key={d.grade}>
                  <div className="mb-0.5 flex justify-between text-xs text-slate-600">
                    <span>{d.grade}</span>
                    <span>{((d.count / distTotal) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-[#2563eb]"
                      style={{ width: `${(d.count / distTotal) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </ExamCard>
          <ExamCard>
            <p className="mb-2 font-semibold text-[#1e3a8a]">Subject analysis</p>
            <table className="min-w-full text-left text-xs">
              <thead className="uppercase text-slate-500">
                <tr>
                  <th className="py-1">Subject</th>
                  <th>High</th>
                  <th>Low</th>
                  <th>Avg</th>
                  <th>Pass %</th>
                </tr>
              </thead>
              <tbody>
                {(reports.data?.subjects ?? []).map((s: any) => (
                  <tr key={s.name} className="border-t border-slate-100">
                    <td className="py-1 font-medium">{s.name}</td>
                    <td>{num(s.highest)}</td>
                    <td>{num(s.lowest)}</td>
                    <td>{num(s.average).toFixed(1)}</td>
                    <td>{num(s.passPercent).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ExamCard>
        </div>
      ) : null}

      {rankingEnabled && (reports.data?.top ?? []).length ? (
        <ExamCard>
          <p className="mb-2 font-semibold text-[#1e3a8a]">Top performers</p>
          <ol className="space-y-1 text-sm">
            {(reports.data.top as any[]).slice(0, 10).map((r, i) => (
              <li key={r.id}>
                {i + 1}. {r.student?.fullName} · {num(r.percent)}% · {r.grade}
              </li>
            ))}
          </ol>
        </ExamCard>
      ) : null}

      <ExamCard>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                {rankingEnabled ? <th className="px-2 py-2">Rank</th> : null}
                <th className="px-2 py-2">Student</th>
                <th className="px-2 py-2">Total</th>
                <th className="px-2 py-2">%</th>
                <th className="px-2 py-2">Grade</th>
                <th className="px-2 py-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-slate-100 cursor-pointer"
                  onClick={() => setOpenId(openId === r.id ? null : r.id)}
                >
                  {rankingEnabled ? (
                    <td className="px-2 py-2">{r.rankSection ?? r.rankClass ?? '—'}</td>
                  ) : null}
                  <td className="px-2 py-2 font-medium">
                    {r.student?.fullName}
                    <div className="text-xs text-slate-500">{r.student?.admissionNumber}</div>
                  </td>
                  <td className="px-2 py-2">
                    {num(r.totalObtained)}/{num(r.totalMax)}
                  </td>
                  <td className="px-2 py-2">{num(r.percent)}%</td>
                  <td className="px-2 py-2">{r.grade ?? '—'}</td>
                  <td className="px-2 py-2">
                    <ExamBadge value={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {openId ? (
          <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
            {rows
              .filter((r) => r.id === openId)
              .map((r) => (
                <div key={r.id}>
                  {(r.subjects ?? []).map((s: any) => (
                    <p key={s.id}>
                      {s.subject?.name}: {num(s.obtained)}/{num(s.max)} · {s.grade} · {s.status}
                      {num(s.graceApplied) ? ` · grace ${num(s.graceApplied)}` : ''}
                    </p>
                  ))}
                  {num(r.graceApplied) ? (
                    <p className="mt-1 text-amber-800">
                      PASS WITH GRACE: {num(r.graceApplied)} mark(s)
                    </p>
                  ) : null}
                  {r.remarks ? <p className="mt-1 text-slate-600">{r.remarks}</p> : null}
                </div>
              ))}
          </div>
        ) : null}
      </ExamCard>
    </ExamShell>
  );
}
