'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  fetchSchoolAcademicClasses,
  fetchSchoolExam,
  fetchSchoolExamMarksRoster,
  fetchSchoolExams,
  reopenSchoolExamMarks,
  saveSchoolExamMarks,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { ExamBadge, ExamCard, ExamShell, examField, num } from './exams-ui';
import { GhostButton, PrimaryButton } from '../academic/academic-ui';

const STATUSES = ['PRESENT', 'ABSENT', 'MEDICAL', 'EXEMPTED', 'NOT_APPEARED', 'WITHHELD'];

export function ExamMarksDesk() {
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
  const [componentId, setComponentId] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const exam = useQuery({
    queryKey: ['school-exam', examId],
    queryFn: () => fetchSchoolExam(examId),
    enabled: enabled && Boolean(examId),
  });

  const components = useMemo(() => {
    const list: Array<{ id: string; label: string; max: number }> = [];
    for (const s of ((exam.data as any)?.subjects ?? []) as any[]) {
      for (const c of s.components ?? []) {
        list.push({
          id: c.id,
          label: `${s.grade?.name} · ${s.subject?.name} · ${c.name}`,
          max: num(c.maxMarks),
        });
      }
    }
    return list;
  }, [exam.data]);

  const selected = components.find((c) => c.id === componentId);
  const deadline = (exam.data as any)?.marksDeadline
    ? new Date((exam.data as any).marksDeadline)
    : null;
  const expired = deadline ? deadline.getTime() < Date.now() && !canManage : false;

  const load = useMutation({
    mutationFn: () => fetchSchoolExamMarksRoster({ examId, sectionId, componentId }),
    onSuccess: (data) => {
      setRows(data.rows ?? []);
      setLoaded(true);
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const save = useMutation({
    mutationFn: (submit: boolean) =>
      saveSchoolExamMarks({
        examId,
        componentId,
        submit,
        rows: rows.map((r) => ({
          studentId: r.studentId,
          marks:
            r.status === 'PRESENT'
              ? r.marks === '' || r.marks == null
                ? null
                : Number(r.marks)
              : null,
          status: r.status,
          remarks: r.remarks,
        })),
      }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['school-exams-dash'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const reopen = useMutation({
    mutationFn: () => {
      const reason = prompt('Reason for reopening marks?') || '';
      return reopenSchoolExamMarks({ examId, componentId, reason });
    },
    onSuccess: () => load.mutate(),
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function setRow(i: number, patch: Record<string, unknown>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function importCsv(text: string) {
    const lines = text.trim().split(/\r?\n/);
    const header =
      lines
        .shift()
        ?.split(',')
        .map((h) => h.trim().toLowerCase()) ?? [];
    const adm = header.findIndex((h) => h.includes('admission'));
    const marksI = header.findIndex((h) => h === 'marks');
    const statusI = header.findIndex((h) => h === 'status');
    const remarksI = header.findIndex((h) => h.includes('remark'));
    const max = selected?.max ?? 0;
    let invalid = 0;
    const next = [...rows];
    for (const line of lines) {
      const cols = line.split(',');
      const admission = cols[adm]?.trim();
      const target = next.find((r) => r.admissionNumber === admission);
      if (!target) {
        invalid += 1;
        continue;
      }
      const marks = marksI >= 0 ? Number(cols[marksI]) : null;
      if (marks != null && !Number.isNaN(marks) && marks > max) {
        invalid += 1;
        continue;
      }
      target.marks = Number.isNaN(marks as number) ? null : marks;
      if (statusI >= 0) target.status = cols[statusI]?.trim().toUpperCase() || 'PRESENT';
      if (remarksI >= 0) target.remarks = cols[remarksI]?.trim() ?? '';
    }
    setRows(next);
    setError(
      invalid
        ? `Import preview applied. ${invalid} row(s) could not be matched or exceeded maximum marks and were skipped in this preview.`
        : null,
    );
  }

  return (
    <ExamShell
      title="Marks Entry"
      subtitle="Load a class, enter marks inline, then save a draft or submit."
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
              setLoaded(false);
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
            <option value="">Section</option>
            {(classes.data?.sections ?? []).map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.grade?.name} {s.name}
              </option>
            ))}
          </select>
          <select
            className={examField}
            value={componentId}
            onChange={(e) => setComponentId(e.target.value)}
          >
            <option value="">Assessment component</option>
            {components.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <PrimaryButton
            disabled={!examId || !sectionId || !componentId || load.isPending}
            onClick={() => load.mutate()}
          >
            Load students
          </PrimaryButton>
        </div>
        {deadline ? (
          <p className="mt-2 text-xs text-slate-500">
            Submission deadline: {deadline.toLocaleDateString('en-IN')}
            {expired ? ' — expired. Request an administrator extension.' : ''}
          </p>
        ) : null}
      </ExamCard>

      {loaded ? (
        <ExamCard>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              Maximum marks: <strong>{selected?.max ?? '—'}</strong>. Enter / Tab moves to the next
              student. Absent is stored as a status, not zero.
            </p>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-white px-3 text-sm ring-1 ring-slate-200">
                Import Excel/CSV
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) importCsv(await f.text());
                  }}
                />
              </label>
              <GhostButton
                onClick={() => {
                  const header =
                    'Admission No.,Roll No.,Student Name,Class,Section,Subject,Maximum Marks,Marks,Status,Remarks';
                  const body = rows
                    .map((r) =>
                      [
                        r.admissionNumber,
                        r.rollNumber,
                        r.fullName,
                        '',
                        '',
                        '',
                        selected?.max ?? '',
                        r.marks ?? '',
                        r.status,
                        r.remarks ?? '',
                      ].join(','),
                    )
                    .join('\n');
                  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = 'marks-template.csv';
                  a.click();
                }}
              >
                Download template
              </GhostButton>
              {canManage ? (
                <GhostButton onClick={() => reopen.mutate()}>Reopen marks</GhostButton>
              ) : null}
              <GhostButton disabled={expired || save.isPending} onClick={() => save.mutate(false)}>
                Save draft
              </GhostButton>
              <PrimaryButton
                disabled={expired || save.isPending}
                onClick={() => {
                  if (
                    confirm(
                      'Submit marks? Submitted entries are locked until an administrator reopens them.',
                    )
                  )
                    save.mutate(true);
                }}
              >
                Submit marks
              </PrimaryButton>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-2">Roll</th>
                  <th className="px-2 py-2">Student</th>
                  <th className="px-2 py-2">Admission</th>
                  <th className="px-2 py-2">Marks</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const over =
                    r.status === 'PRESENT' &&
                    r.marks != null &&
                    r.marks !== '' &&
                    Number(r.marks) > (selected?.max ?? 0);
                  return (
                    <tr key={r.studentId} className="border-t border-slate-100">
                      <td className="px-2 py-2">{r.rollNumber}</td>
                      <td className="px-2 py-2 font-medium">{r.fullName}</td>
                      <td className="px-2 py-2 text-slate-500">{r.admissionNumber}</td>
                      <td className="px-2 py-2">
                        <input
                          ref={(el) => {
                            inputs.current[i] = el;
                          }}
                          className={`${examField} w-24 ${over ? 'border-rose-400' : ''}`}
                          value={
                            r.status === 'PRESENT'
                              ? (r.marks ?? '')
                              : r.status === 'ABSENT'
                                ? 'AB'
                                : r.status
                          }
                          disabled={r.status !== 'PRESENT' || r.entryStatus === 'SUBMITTED'}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v !== '' && Number(v) < 0) return;
                            setRow(i, { marks: v });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Tab') {
                              e.preventDefault();
                              inputs.current[i + 1]?.focus();
                            }
                          }}
                        />
                        {over ? (
                          <p className="text-[11px] text-rose-600">
                            Marks cannot exceed {selected?.max}.
                          </p>
                        ) : null}
                      </td>
                      <td className="px-2 py-2">
                        <select
                          className={examField}
                          value={r.status}
                          disabled={r.entryStatus === 'SUBMITTED'}
                          onChange={(e) => setRow(i, { status: e.target.value })}
                        >
                          {STATUSES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={examField}
                          value={r.remarks ?? ''}
                          disabled={r.entryStatus === 'SUBMITTED'}
                          onChange={(e) => setRow(i, { remarks: e.target.value })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows[0]?.entryStatus ? (
            <p className="mt-2 text-xs text-slate-500">
              Entry status: <ExamBadge value={rows[0].entryStatus} />
            </p>
          ) : null}
        </ExamCard>
      ) : null}
    </ExamShell>
  );
}
