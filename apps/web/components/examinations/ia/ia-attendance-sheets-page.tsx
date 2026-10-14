'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  downloadAttendanceSheets,
  fetchAttendanceSheets,
  fetchIaExams,
  fetchIaPapers,
} from '@/services/examinations-ia';
import { downloadBlob } from '@/utils/download-blob';

export function IaAttendanceSheetsPage() {
  const exams = useQuery({ queryKey: ['ia-exams'], queryFn: fetchIaExams });
  const [sessionId, setSessionId] = useState('');
  const [mode, setMode] = useState<'subject' | 'hall'>('subject');
  const [date, setDate] = useState('');
  const [session, setSession] = useState('');
  const [paperId, setPaperId] = useState('');
  const [hall, setHall] = useState('');
  const activeId = sessionId || exams.data?.[0]?.id || '';
  const papers = useQuery({
    queryKey: ['ia-papers', activeId],
    queryFn: () => fetchIaPapers({ sessionId: activeId }),
    enabled: Boolean(activeId),
  });
  const params = {
    mode,
    date: date || undefined,
    session: session || undefined,
    paperId: paperId || undefined,
    hall: hall || undefined,
  };
  const preview = useQuery({
    queryKey: ['attendance-sheets', activeId, params],
    queryFn: () => fetchAttendanceSheets(activeId, params),
    enabled: Boolean(activeId),
  });

  const download = async (kind: 'pdf' | 'xlsx') => {
    if (!activeId) return;
    const blob = await downloadAttendanceSheets(activeId, kind, params);
    downloadBlob(
      blob,
      kind === 'pdf' ? 'examination-attendance-sheets.pdf' : 'examination-attendance-sheets.xlsx',
    );
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-white p-4">
        <h1 className="text-xl font-semibold">Attendance Sheets</h1>
        <p className="text-sm text-slate-500">
          Subject-wise sheets split by hall. Hall-wise sheets group every subject in that room.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <select
            className="h-10 rounded-xl border px-3 text-sm"
            value={activeId}
            onChange={(event) => setSessionId(event.target.value)}
          >
            {(exams.data ?? []).map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-xl border px-3 text-sm"
            value={mode}
            onChange={(event) => setMode(event.target.value as 'subject' | 'hall')}
          >
            <option value="subject">Subject-wise</option>
            <option value="hall">Hall-wise</option>
          </select>
          <input
            className="h-10 rounded-xl border px-3 text-sm"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <select
            className="h-10 rounded-xl border px-3 text-sm"
            value={session}
            onChange={(event) => setSession(event.target.value)}
          >
            <option value="">All sessions</option>
            <option value="MORNING">Morning</option>
            <option value="AFTERNOON">Afternoon</option>
          </select>
          <select
            className="h-10 rounded-xl border px-3 text-sm"
            value={paperId}
            onChange={(event) => setPaperId(event.target.value)}
          >
            <option value="">All subjects</option>
            {(papers.data ?? []).map((paper) => (
              <option key={paper.id} value={paper.id}>
                {paper.paperCode} {paper.paperName}
              </option>
            ))}
          </select>
          <input
            className="h-10 rounded-xl border px-3 text-sm"
            placeholder="Hall number, optional"
            value={hall}
            onChange={(event) => setHall(event.target.value)}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="button" onClick={() => void download('pdf')}>
            Generate PDF
          </Button>
          <Button type="button" variant="outline" onClick={() => void download('xlsx')}>
            Export Excel
          </Button>
        </div>
      </section>
      <section className="rounded-2xl border bg-white p-4 text-sm">
        <p>
          {preview.data?.studentCount ?? 0} students · {preview.data?.sheets.length ?? 0} sheets
        </p>
        <ul className="mt-3 space-y-1">
          {(preview.data?.sheets ?? []).slice(0, 40).map((sheet) => (
            <li key={`${sheet.subjectCode}-${sheet.hall}`}>
              {sheet.subjectCode} {sheet.subjectName} · Hall {sheet.hall} · {sheet.studentCount}{' '}
              students
            </li>
          ))}
        </ul>
        {preview.data?.issues.length ? (
          <div className="mt-4 rounded-xl bg-amber-50 p-3 text-amber-800">
            {preview.data.issues.slice(0, 12).map((issue) => (
              <p key={`${issue.collegeRoll}-${issue.message}`}>
                {issue.collegeRoll} {issue.name}: {issue.message}
              </p>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
