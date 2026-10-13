'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import {
  fetchIaExams,
  fetchIaResultPreview,
  type IaResultPreview,
  type IaResultPreviewPaper,
} from '@/services/examinations-ia';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const TILES = ['#1d4ed8', '#7c3aed', '#d97706', '#059669', '#0f766e', '#be123c'];

function formatMark(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : String(Math.round(number * 100) / 100);
}

function initials(name?: string | null) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'ST';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function IaStudentResultLookup() {
  const exams = useQuery({ queryKey: ['ia', 'exams'], queryFn: fetchIaExams });
  const [sessionId, setSessionId] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<IaResultPreview | null>(null);

  useEffect(() => {
    if (sessionId || !exams.data?.length) return;
    const preferred = exams.data.find((exam) => exam.status === 'SCHEDULED') ?? exams.data[0];
    if (preferred) setSessionId(preferred.id);
  }, [exams.data, sessionId]);

  const load = async (params: { q?: string; studentId?: string }) => {
    if (!sessionId) {
      setError('Choose the examination first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setResult(await fetchIaResultPreview({ ...params, sessionId }));
    } catch (err) {
      setResult(null);
      setError(apiErrorMessage(err, 'The student result could not be loaded.'));
    } finally {
      setLoading(false);
    }
  };

  const papers = result?.papers ?? [];
  const student = result?.student;
  const passed = papers.filter((paper) => paper.outcome === 'PASS').length;
  const notPassed = papers.length - passed;
  const examName =
    result?.exam?.name || exams.data?.find((exam) => exam.id === sessionId)?.name || '';

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Student result</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose the examination, then search by roll number or student name.
        </p>
        <form
          className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const q = query.trim();
            if (q.length < 2) {
              setError('Type at least two characters of the name or roll number.');
              return;
            }
            void load({ q });
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Examination</span>
            <select
              value={sessionId}
              onChange={(event) => {
                setSessionId(event.target.value);
                setResult(null);
              }}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-400"
            >
              <option value="">Select an examination</option>
              {(exams.data ?? []).map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Roll number or name
            </span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="BA24-458 or Ankit Hajong"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400"
              />
            </span>
          </label>
          <button
            type="submit"
            disabled={loading || !sessionId}
            className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Show result
          </button>
        </form>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </section>

      {result && !student && result.matches.length > 1 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-900">
              {result.matches.length} students match
            </h3>
            <p className="text-xs text-slate-500">Choose the student to open the result.</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {result.matches.map((match) => (
              <li key={match.id}>
                <button
                  type="button"
                  onClick={() => void load({ studentId: match.id })}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                    {initials(match.fullName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {match.fullName || 'Student'}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {match.programme || 'Programme not set'}
                    </span>
                  </span>
                  <span className="text-sm font-medium text-slate-600">{match.rollNumber}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result && !student && result.matches.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
          No student matches that roll number or name.
        </section>
      ) : null}

      {student ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-4 bg-[#0f3c89] px-5 py-5 text-white">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold">
              {initials(student.fullName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold">{student.fullName || 'Student'}</p>
              <p className="text-sm text-blue-100">
                {student.rollNumber || 'No roll number'}
                {student.programme ? ` · ${student.programme}` : ''}
              </p>
              <p className="mt-1 text-xs text-blue-200">{examName}</p>
            </div>
          </div>

          <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-3">
            <Stat label="Appeared" value={papers.length} />
            <Stat label="Passed" value={passed} tone="green" />
            <Stat label="Not passed" value={notPassed} tone={notPassed ? 'red' : 'slate'} />
          </div>

          {papers.length ? (
            <ul className="divide-y divide-slate-100">
              {papers.map((paper, index) => (
                <PaperRow key={paper.paperId} paper={paper} tint={TILES[index % TILES.length]} />
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-sm text-slate-500">
              No saved marks for this student in {examName || 'this examination'}.
            </p>
          )}

          {papers.length ? (
            <p
              className={cn(
                'mx-4 mb-4 rounded-xl px-4 py-3 text-sm',
                notPassed ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700',
              )}
            >
              {notPassed
                ? `${notPassed} paper${notPassed === 1 ? '' : 's'} not passed.`
                : 'Passed every paper that has a saved mark.'}
              {papers.some((paper) => paper.released === false)
                ? ' Students do not see a paper until its marks are locked.'
                : ''}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number;
  tone?: 'slate' | 'green' | 'red';
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p
        className={cn(
          'text-2xl font-bold',
          tone === 'green' && 'text-emerald-600',
          tone === 'red' && 'text-rose-600',
          tone === 'slate' && 'text-slate-900',
        )}
      >
        {value}
      </p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function PaperRow({ paper, tint }: { paper: IaResultPreviewPaper; tint: string }) {
  const absent = paper.outcome === 'ABSENT' || paper.isAbsent;
  const passed = paper.outcome === 'PASS';
  return (
    <li className="flex flex-wrap items-center gap-4 px-5 py-4">
      <span
        className="flex h-12 w-16 shrink-0 items-center justify-center rounded-xl text-center text-[11px] font-bold leading-tight text-white"
        style={{ backgroundColor: tint }}
      >
        {paper.paperCode || 'Paper'}
      </span>
      <div className="min-w-[180px] flex-1">
        <p className="text-sm font-semibold text-slate-900">{paper.paperName || 'Paper'}</p>
        <p className="text-xs text-slate-500">
          {paper.released === false ? 'Saved · not on the student app yet' : 'On the student app'}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        <Mark label="Maximum" value={formatMark(paper.maxMarks)} />
        <Mark label="Pass mark" value={formatMark(paper.passMark)} />
        <Mark label="Secured" value={absent ? 'AB' : formatMark(paper.marks)} strong />
      </div>
      <span
        className={cn(
          'inline-flex min-w-[72px] justify-center rounded-full px-3 py-1 text-xs font-semibold',
          passed && 'bg-emerald-50 text-emerald-700',
          paper.outcome === 'FAIL' && 'bg-rose-50 text-rose-700',
          absent && 'bg-amber-50 text-amber-700',
        )}
      >
        {absent ? 'Absent' : passed ? 'Pass' : 'Fail'}
      </span>
    </li>
  );
}

function Mark({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className={cn('text-base font-bold text-slate-900', strong && 'text-lg')}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}
