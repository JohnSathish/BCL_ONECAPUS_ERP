'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CalendarPlus, Copy, Download, Printer, Trash2 } from 'lucide-react';
import {
  downloadIaNoticeboardRoutinePdf,
  downloadIaRoutineExcel,
  fetchIaNoticeboardRoutineHtml,
  saveIaRoutine,
  type IaExamSummary,
  type IaPaper,
} from '@/services/examinations-ia';
import { apiErrorMessage } from '@/utils/api-error';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const BASKETS = new Set(['AEC', 'MDC', 'SEC', 'VAC', 'VTC', 'INTERNSHIP']);

type Sitting = {
  key: string;
  examDate: string;
  startTime: string;
  endTime: string;
  paperIds: string[];
};

function isoDate(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function clock24(value: string | null | undefined) {
  if (!value) return '';
  const match = value.match(/T(\d{2}):(\d{2})/) ?? value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function weekday(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return '';
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? '';
}

function plusDays(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function subjectLabel(paper: IaPaper) {
  const raw = (paper.category || paper.metadata?.category || '').toUpperCase();
  if (BASKETS.has(raw) || [...BASKETS].some((name) => raw.startsWith(name))) {
    return [...BASKETS].find((name) => raw === name || raw.startsWith(name)) ?? raw;
  }
  return paper.paperCode;
}

function isPlaceholder(paper: IaPaper) {
  return clock24(paper.startTime) === '10:00' && clock24(paper.endTime) === '12:00';
}

function seedSittings(papers: IaPaper[]): Sitting[] {
  const groups = new Map<string, Sitting>();
  for (const paper of papers) {
    if (paper.status === 'UNSCHEDULED' || isPlaceholder(paper) || !isoDate(paper.examDate))
      continue;
    const examDate = isoDate(paper.examDate);
    const startTime = clock24(paper.startTime) || '13:00';
    const endTime = clock24(paper.endTime) || '14:15';
    const key = `${examDate}|${startTime}|${endTime}`;
    const sitting = groups.get(key) ?? { key, examDate, startTime, endTime, paperIds: [] };
    sitting.paperIds.push(paper.id);
    groups.set(key, sitting);
  }
  return [...groups.values()].sort(
    (a, b) => a.examDate.localeCompare(b.examDate) || a.startTime.localeCompare(b.startTime),
  );
}

function sessionWord(startTime: string) {
  const hour = Number(startTime.slice(0, 2));
  if (!startTime) return 'Session';
  return hour < 12 ? 'Morning' : 'Afternoon';
}

function routineWarnings(sittings: Sitting[], papers: IaPaper[], instructions: string) {
  const warnings: string[] = [];
  const byId = new Map(papers.map((paper) => [paper.id, paper]));
  const seenCode = new Map<string, string>();
  for (const sitting of sittings) {
    if (sitting.startTime >= sitting.endTime) {
      warnings.push(`${sitting.examDate}: the end time must be later than the start time.`);
    }
    if (!sitting.paperIds.length) {
      warnings.push(`${sitting.examDate} ${sessionWord(sitting.startTime)} has no subject.`);
    }
    for (const id of sitting.paperIds) {
      const paper = byId.get(id);
      if (!paper) continue;
      const key = `${paper.semesterNo ?? 0}|${paper.paperCode.toUpperCase()}`;
      const slot = `${sitting.examDate} ${sitting.startTime}`;
      const previous = seenCode.get(key);
      if (previous && previous !== slot) {
        warnings.push(`${paper.paperCode} is on the routine more than once.`);
      } else if (!previous) seenCode.set(key, slot);
    }
  }
  if (!instructions.trim()) warnings.push('Add the examination instructions before publishing.');
  const placed = new Set(sittings.flatMap((sitting) => sitting.paperIds));
  const leftOut = papers.filter((paper) => !placed.has(paper.id)).length;
  if (leftOut) warnings.push(`${leftOut} subjects are not on this routine yet.`);
  return [...new Set(warnings)];
}

export function IaRoutineBuilder({
  exam,
  papers,
  papersReady,
  onChanged,
}: {
  exam: IaExamSummary | null;
  papers: IaPaper[];
  papersReady: boolean;
  onChanged: () => void;
}) {
  const [sittings, setSittings] = useState<Sitting[]>([]);
  const [instructions, setInstructions] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(75);
  const [passMarks, setPassMarks] = useState('');
  const [extraSemesters, setExtraSemesters] = useState<number[]>([]);
  const [hiddenSemesters, setHiddenSemesters] = useState<number[]>([]);
  const [preview, setPreview] = useState(true);
  const [message, setMessage] = useState('');
  const [serverWarnings, setServerWarnings] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [savedHere, setSavedHere] = useState(false);
  const seededFor = useRef('');

  useEffect(() => {
    if (!exam || !papersReady || seededFor.current === exam.id) return;
    if (papers.some((paper) => paper.sessionId !== exam.id)) return;
    seededFor.current = exam.id;
    setSittings(seedSittings(papers));
    setInstructions(exam.instructions ?? '');
    setDurationMinutes(Number(exam.metadata?.examDurationMinutes ?? 75) || 75);
    const pass = exam.metadata?.passMarks;
    const max = exam.metadata?.maxMarks ?? exam.stats?.maxMarks;
    setPassMarks(
      pass != null ? String(pass) : max != null ? String(Math.ceil(Number(max) * 0.4)) : '',
    );
    setExtraSemesters([]);
    setHiddenSemesters([]);
    setDirty(false);
    setSavedHere(false);
    setMessage('');
    setServerWarnings([]);
  }, [exam, papers, papersReady]);

  const semesters = useMemo(() => {
    const fromPapers = papers
      .map((paper) => paper.semesterNo)
      .filter((n): n is number => n != null);
    const fromExam = exam?.stats?.semesterNos ?? exam?.metadata?.semesterNos ?? [];
    return [...new Set([...fromExam, ...fromPapers, ...extraSemesters])]
      .filter((semesterNo) => !hiddenSemesters.includes(semesterNo))
      .sort((a, b) => a - b);
  }, [papers, exam, extraSemesters, hiddenSemesters]);

  const placed = useMemo(
    () => new Set(sittings.flatMap((sitting) => sitting.paperIds)),
    [sittings],
  );
  const warnings = useMemo(
    () => [...routineWarnings(sittings, papers, instructions), ...serverWarnings],
    [sittings, papers, instructions, serverWarnings],
  );

  const updateSitting = (key: string, patch: Partial<Sitting>) => {
    setDirty(true);
    setSittings((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const addSitting = (kind: 'morning' | 'afternoon' | 'date' | 'copy') => {
    setDirty(true);
    const last = sittings[sittings.length - 1];
    const base =
      last?.examDate || isoDate(exam?.startDate) || new Date().toISOString().slice(0, 10);
    const examDate = kind === 'date' || kind === 'copy' ? plusDays(base, last ? 1 : 0) : base;
    if (kind === 'copy' && last) {
      setSittings((rows) => [
        ...rows.map((row) => (row.key === last.key ? { ...row, paperIds: [] } : row)),
        {
          key: `${examDate}|${last.startTime}|${Date.now()}`,
          examDate,
          startTime: last.startTime,
          endTime: last.endTime,
          paperIds: [...last.paperIds],
        },
      ]);
      return;
    }
    const startTime = kind === 'morning' ? '09:45' : '13:00';
    const endTime = kind === 'morning' ? '11:00' : '14:15';
    setSittings((rows) => [
      ...rows,
      { key: `${examDate}|${startTime}|${Date.now()}`, examDate, startTime, endTime, paperIds: [] },
    ]);
  };

  const removeSitting = (key: string) => {
    if (!window.confirm('Remove this examination session from the routine?')) return;
    setDirty(true);
    setSittings((rows) => rows.filter((row) => row.key !== key));
  };

  const addLabel = (sittingKey: string, semesterNo: number, label: string) => {
    const ids = papers
      .filter(
        (paper) =>
          paper.semesterNo === semesterNo &&
          subjectLabel(paper) === label &&
          !sittings.find((row) => row.key === sittingKey)?.paperIds.includes(paper.id),
      )
      .map((paper) => paper.id);
    if (!ids.length) return;
    setDirty(true);
    setSittings((rows) =>
      rows.map((row) => ({
        ...row,
        paperIds:
          row.key === sittingKey
            ? [...new Set([...row.paperIds, ...ids])]
            : row.paperIds.filter((id) => !ids.includes(id)),
      })),
    );
  };

  const removeLabel = (sittingKey: string, ids: string[]) => {
    setDirty(true);
    setSittings((rows) =>
      rows.map((row) =>
        row.key === sittingKey
          ? { ...row, paperIds: row.paperIds.filter((id) => !ids.includes(id)) }
          : row,
      ),
    );
  };

  const save = useMutation({
    mutationFn: (publish: { publish: boolean; acknowledgeWarnings?: boolean }) => {
      if (!exam) throw new Error('Choose an examination first.');
      return saveIaRoutine(exam.id, {
        sittings: sittings.map((sitting) => ({
          examDate: sitting.examDate,
          startTime: sitting.startTime,
          endTime: sitting.endTime,
          paperIds: sitting.paperIds,
        })),
        instructions,
        durationMinutes,
        passMarks: passMarks === '' ? undefined : Number(passMarks),
        publish: publish.publish,
        acknowledgeWarnings: publish.acknowledgeWarnings,
      });
    },
    onSuccess: (result, variables) => {
      setDirty(false);
      setSavedHere(true);
      setServerWarnings(result.warnings ?? []);
      setMessage(
        variables.publish
          ? result.revised
            ? `Routine revised and published. ${result.updated} subjects are on the timetable.`
            : `Routine published. ${result.updated} subjects are on the timetable.`
          : `Draft saved. ${result.updated} subjects are on the timetable.`,
      );
      onChanged();
    },
    onError: (error, variables) => {
      const data = (error as { response?: { data?: { warnings?: string[]; message?: string } } })
        ?.response?.data;
      if (variables.publish && data?.warnings?.length) {
        setServerWarnings(data.warnings);
        if (
          window.confirm(
            `${data.message || 'This routine has warnings.'}\n\n${data.warnings.join('\n')}\n\nPublish anyway?`,
          )
        ) {
          save.mutate({ publish: true, acknowledgeWarnings: true });
        }
        return;
      }
      setMessage(apiErrorMessage(error, 'Could not save the routine.'));
    },
  });

  const downloadPdf = useMutation({
    mutationFn: () => downloadIaNoticeboardRoutinePdf(exam!.id),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: (error) => setMessage(apiErrorMessage(error, 'Could not download the PDF.')),
  });

  const downloadExcel = useMutation({
    mutationFn: () => downloadIaRoutineExcel(exam!.id),
    onError: (error) => setMessage(apiErrorMessage(error, 'Could not download the Excel file.')),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    },
  });

  const printSheet = useMutation({
    mutationFn: () => fetchIaNoticeboardRoutineHtml(exam!.id),
    onSuccess: (html) => {
      const popup = window.open('', '_blank');
      if (!popup) {
        setMessage('Allow popups to print, or download the PDF.');
        return;
      }
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      setTimeout(() => popup.print(), 400);
    },
    onError: (error) => setMessage(apiErrorMessage(error, 'Could not open the print view.')),
  });

  const askExport = (run: () => void) => {
    if (dirty) {
      setMessage('Save the routine first so the PDF and Excel match this screen.');
      return;
    }
    if (!savedHere && exam?.metadata?.timetableSource !== 'BUILDER') {
      setMessage('Save this routine once so the official sheet uses these dates.');
      return;
    }
    run();
  };

  if (!exam) {
    return <p className="text-sm text-slate-500">Choose an examination to build its routine.</p>;
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Routine builder</h2>
          <p className="text-xs text-slate-500">
            {exam.name} · {exam.status}
            {Number(exam.metadata?.routineRevision) > 1 ? ' · Revised' : ''}
            {' · '}
            Students see this only after you publish it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={ghost} onClick={() => addSitting('date')}>
            <CalendarPlus className="h-3.5 w-3.5" /> Add date
          </button>
          <button type="button" className={ghost} onClick={() => addSitting('morning')}>
            Add morning
          </button>
          <button type="button" className={ghost} onClick={() => addSitting('afternoon')}>
            Add afternoon
          </button>
          <button
            type="button"
            className={ghost}
            onClick={() => addSitting('copy')}
            title="Moves the last session's subjects onto the next date"
          >
            <Copy className="h-3.5 w-3.5" /> Copy last session
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs font-medium text-slate-600">
          Duration (minutes)
          <input
            type="number"
            min={1}
            max={480}
            value={durationMinutes}
            onChange={(event) => {
              setDirty(true);
              setDurationMinutes(Number(event.target.value) || 75);
            }}
            className={field}
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Pass marks
          <input
            type="number"
            min={0}
            value={passMarks}
            onChange={(event) => {
              setDirty(true);
              setPassMarks(event.target.value);
            }}
            className={field}
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Semester columns
          <span className="mt-1 flex flex-wrap gap-1">
            {semesters.map((semesterNo) => (
              <button
                key={semesterNo}
                type="button"
                className="rounded-full bg-slate-100 px-2 py-1 text-xs"
                onClick={() => {
                  if (!window.confirm(`Hide Semester ${semesterNo} from this routine view?`))
                    return;
                  setHiddenSemesters((rows) => [...rows, semesterNo]);
                }}
              >
                Sem {semesterNo} ×
              </button>
            ))}
            <button
              type="button"
              className="rounded-full border border-dashed border-slate-300 px-2 py-1 text-xs"
              onClick={() => {
                const value = window.prompt('Semester number to add');
                const semesterNo = Number(value);
                if (!semesterNo || semesterNo < 1 || semesterNo > 12) return;
                setExtraSemesters((rows) => [...rows, semesterNo]);
                setHiddenSemesters((rows) => rows.filter((item) => item !== semesterNo));
              }}
            >
              Add semester
            </button>
          </span>
        </label>
      </div>

      <label className="block text-xs font-medium text-slate-600">
        Examination instructions
        <textarea
          value={instructions}
          onChange={(event) => {
            setDirty(true);
            setInstructions(event.target.value);
          }}
          rows={4}
          placeholder={
            'Admit cards will be issued from 8 October 2026.\nMaximum marks: 15. Duration: 1 hour 15 minutes.\nFollow the NEHU question pattern.'
          }
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </label>

      <div className="space-y-3">
        {sittings.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
            Add a date, then choose the morning or afternoon subjects for each semester.
          </p>
        ) : null}
        {sittings.map((sitting, index) => (
          <article key={sitting.key} className="rounded-xl border border-slate-200 p-3">
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <span className="text-xs font-semibold text-slate-400">{index + 1}</span>
              <label className="text-xs text-slate-500">
                Date
                <input
                  type="date"
                  value={sitting.examDate}
                  onChange={(event) => updateSitting(sitting.key, { examDate: event.target.value })}
                  className={field}
                />
              </label>
              <span className="pb-2 text-sm font-medium text-slate-700">
                {weekday(sitting.examDate)}
              </span>
              <label className="text-xs text-slate-500">
                Session
                <select
                  value={sessionWord(sitting.startTime) === 'Morning' ? 'morning' : 'afternoon'}
                  onChange={(event) => {
                    const morning = event.target.value === 'morning';
                    updateSitting(sitting.key, {
                      startTime: morning ? '09:45' : '13:00',
                      endTime: morning ? '11:00' : '14:15',
                    });
                  }}
                  className={field}
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                </select>
              </label>
              <label className="text-xs text-slate-500">
                Start
                <input
                  type="time"
                  value={sitting.startTime}
                  onChange={(event) =>
                    updateSitting(sitting.key, { startTime: event.target.value })
                  }
                  className={field}
                />
              </label>
              <label className="text-xs text-slate-500">
                End
                <input
                  type="time"
                  value={sitting.endTime}
                  onChange={(event) => updateSitting(sitting.key, { endTime: event.target.value })}
                  className={field}
                />
              </label>
              <button
                type="button"
                className="mb-0.5 text-rose-600"
                onClick={() => removeSitting(sitting.key)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {semesters.map((semesterNo) => {
                const groups = new Map<string, string[]>();
                for (const id of sitting.paperIds) {
                  const paper = papers.find((item) => item.id === id);
                  if (!paper || paper.semesterNo !== semesterNo) continue;
                  const label = subjectLabel(paper);
                  groups.set(label, [...(groups.get(label) ?? []), id]);
                }
                const choices = [
                  ...new Set(
                    papers
                      .filter((paper) => paper.semesterNo === semesterNo && !placed.has(paper.id))
                      .map(subjectLabel),
                  ),
                ].sort();
                return (
                  <div key={semesterNo} className="rounded-lg bg-slate-50 p-2">
                    <p className="mb-1 text-xs font-semibold text-slate-500">
                      Semester {semesterNo}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {[...groups.entries()].map(([label, ids]) => (
                        <button
                          key={label}
                          type="button"
                          className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-blue-800 ring-1 ring-blue-100"
                          onClick={() => removeLabel(sitting.key, ids)}
                          title="Remove this subject"
                        >
                          {label} ×
                        </button>
                      ))}
                    </div>
                    <select
                      value=""
                      onChange={(event) => {
                        if (event.target.value)
                          addLabel(sitting.key, semesterNo, event.target.value);
                      }}
                      className="mt-2 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"
                    >
                      <option value="">Add subject</option>
                      {choices.map((label) => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      {warnings.length ? (
        <ul className="space-y-1 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={ghost}
          disabled={save.isPending}
          onClick={() => {
            if (
              exam.status !== 'DRAFT' &&
              !window.confirm(
                'Saving as draft hides this routine from students until you publish it again.',
              )
            ) {
              return;
            }
            save.mutate({ publish: false });
          }}
        >
          Save as draft
        </button>
        <button
          type="button"
          className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
          disabled={save.isPending}
          onClick={() => {
            if (
              exam.status !== 'DRAFT' &&
              !window.confirm('Publish this revision? Students will see the updated routine.')
            ) {
              return;
            }
            save.mutate({ publish: true });
          }}
        >
          Publish routine
        </button>
        <button type="button" className={ghost} onClick={() => setPreview((open) => !open)}>
          {preview ? 'Hide preview' : 'Preview routine'}
        </button>
        <button
          type="button"
          className={ghost}
          onClick={() => askExport(() => downloadPdf.mutate())}
        >
          <Download className="h-3.5 w-3.5" /> PDF
        </button>
        <button
          type="button"
          className={ghost}
          onClick={() => askExport(() => downloadExcel.mutate())}
        >
          Excel
        </button>
        <button
          type="button"
          className={ghost}
          onClick={() => askExport(() => printSheet.mutate())}
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
      </div>

      {preview ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#163a6b] text-left text-xs uppercase text-white">
                <th className="px-2 py-2">Sl</th>
                <th className="px-2 py-2">Date and day</th>
                <th className="px-2 py-2">Session</th>
                {semesters.map((semesterNo) => (
                  <th key={semesterNo} className="px-2 py-2">
                    Semester {semesterNo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sittings.map((sitting, index) => (
                <tr key={sitting.key} className="border-b border-slate-200">
                  <td className="px-2 py-2">{index + 1}</td>
                  <td className="px-2 py-2">
                    {sitting.examDate.split('-').reverse().join('-')}
                    <div className="text-xs text-slate-500">{weekday(sitting.examDate)}</div>
                  </td>
                  <td className="px-2 py-2">
                    {sessionWord(sitting.startTime)} {sitting.startTime}–{sitting.endTime}
                  </td>
                  {semesters.map((semesterNo) => {
                    const labels = [
                      ...new Set(
                        sitting.paperIds
                          .map((id) => papers.find((paper) => paper.id === id))
                          .filter((paper) => paper?.semesterNo === semesterNo)
                          .map((paper) => subjectLabel(paper!)),
                      ),
                    ];
                    return (
                      <td key={semesterNo} className="px-2 py-2 font-medium text-[#1d4f91]">
                        {labels.length ? labels.join(' / ') : '--------'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {instructions.trim() ? (
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
              {instructions
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => (
                  <li key={line}>{line}</li>
                ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

const field = 'mt-1 block h-9 rounded-lg border border-slate-200 px-2 text-sm';
const ghost =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700';
