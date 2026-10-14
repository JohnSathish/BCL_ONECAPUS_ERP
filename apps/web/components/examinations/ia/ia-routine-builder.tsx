'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  Plus,
  Printer,
  SunMedium,
  Sunset,
  Trash2,
} from 'lucide-react';
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

function ordinal(n: number) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

function prettyDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  const date = new Date(Date.UTC(year, month - 1, day));
  const monthName = date.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
  return `${day} ${monthName} ${year} (${weekday(iso)})`;
}

function clock12(hhmm: string) {
  const [hours, minutes] = hhmm.split(':').map(Number);
  if (Number.isNaN(hours)) return hhmm;
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes || 0).padStart(2, '0')}`;
}

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} minutes`;
  if (!rest) return hours === 1 ? '1 hour' : `${hours} hours`;
  return `${hours} hour ${rest} minutes`;
}

function examTypeLabel(examType?: string) {
  if (!examType) return 'Other';
  if (examType.startsWith('IA_')) return 'Internal Assessment';
  if (examType === 'SEMESTER_END') return 'Semester Examination';
  return 'Other';
}

const DURATIONS = [60, 75, 90, 120, 180];

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
  onBack,
  onChanged,
}: {
  exam: IaExamSummary | null;
  papers: IaPaper[];
  papersReady: boolean;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [sittings, setSittings] = useState<Sitting[]>([]);
  const [instructions, setInstructions] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(75);
  const [passMarks, setPassMarks] = useState('');
  const [extraSemesters, setExtraSemesters] = useState<number[]>([]);
  const [hiddenSemesters, setHiddenSemesters] = useState<number[]>([]);
  const [closedDates, setClosedDates] = useState<Record<string, boolean>>({});
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

  const setSemesterSubject = (sittingKey: string, semesterNo: number, label: string) => {
    const sitting = sittings.find((row) => row.key === sittingKey);
    if (!sitting) return;
    const current = sitting.paperIds.filter((id) => {
      const paper = papers.find((item) => item.id === id);
      return paper?.semesterNo === semesterNo;
    });
    if (!label) {
      removeLabel(sittingKey, current);
      return;
    }
    const incoming = papers
      .filter((paper) => paper.semesterNo === semesterNo && subjectLabel(paper) === label)
      .map((paper) => paper.id);
    setDirty(true);
    setSittings((rows) =>
      rows.map((row) => {
        if (row.key === sittingKey) {
          return {
            ...row,
            paperIds: [
              ...new Set([...row.paperIds.filter((id) => !current.includes(id)), ...incoming]),
            ],
          };
        }
        return { ...row, paperIds: row.paperIds.filter((id) => !incoming.includes(id)) };
      }),
    );
  };

  const addSession = (examDate: string, kind: 'morning' | 'afternoon') => {
    const startTime = kind === 'morning' ? '09:45' : '13:00';
    const endTime = kind === 'morning' ? '11:00' : '14:15';
    if (
      sittings.some(
        (row) => row.examDate === examDate && sessionWord(row.startTime).toLowerCase() === kind,
      )
    ) {
      return;
    }
    setDirty(true);
    setClosedDates((rows) => ({ ...rows, [examDate]: false }));
    setSittings((rows) => [
      ...rows,
      { key: `${examDate}|${startTime}|${Date.now()}`, examDate, startTime, endTime, paperIds: [] },
    ]);
  };

  const removeDate = (examDate: string) => {
    if (!window.confirm(`Remove ${prettyDate(examDate)} and its sessions?`)) return;
    setDirty(true);
    setSittings((rows) => rows.filter((row) => row.examDate !== examDate));
  };

  const dateGroups = useMemo(() => {
    const map = new Map<string, Sitting[]>();
    for (const sitting of sittings) {
      const list = map.get(sitting.examDate) ?? [];
      list.push(sitting);
      map.set(sitting.examDate, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([examDate, rows]) => ({
        examDate,
        rows: [...rows].sort((a, b) => a.startTime.localeCompare(b.startTime)),
      }));
  }, [sittings]);

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

  const copyLastDate = () => {
    const last = dateGroups[dateGroups.length - 1];
    if (!last) {
      addSitting('date');
      return;
    }
    const examDate = plusDays(last.examDate, 1);
    setDirty(true);
    setClosedDates((rows) => ({ ...rows, [examDate]: false }));
    setSittings((rows) => [
      ...rows,
      ...last.rows.map((row, index) => ({
        key: `${examDate}|${row.startTime}|${Date.now()}-${index}`,
        examDate,
        startTime: row.startTime,
        endTime: row.endTime,
        paperIds: [] as string[],
      })),
    ]);
  };

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
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">
          Choose an examination from the list to build its routine.
        </p>
        <button type="button" onClick={onBack} className="mt-4 text-sm font-semibold text-blue-700">
          Back to list
        </button>
      </div>
    );
  }

  const maxMarks = exam.metadata?.maxMarks ?? exam.stats?.maxMarks;
  const yearName = exam.stats?.academicYearName || 'Academic year';
  const shiftName = exam.stats?.shiftName || exam.metadata?.shiftName || 'All shifts';
  const programme =
    exam.stats?.streamName ||
    exam.metadata?.programmeName ||
    exam.metadata?.streamName ||
    'All programmes';
  const monthName = new Date(
    `${dateGroups[0]?.examDate || isoDate(exam.startDate) || '2026-10-01'}T00:00:00`,
  ).toLocaleDateString('en-GB', { month: 'long' });
  const published = ['SCHEDULED', 'ACTIVE', 'OPEN', 'IN_PROGRESS'].includes(exam.status);
  const instructionLines = instructions
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const labelsIn = (sitting: Sitting, semesterNo: number) => {
    const names = sitting.paperIds
      .map((id) => papers.find((paper) => paper.id === id))
      .filter((paper) => paper?.semesterNo === semesterNo)
      .map((paper) => subjectLabel(paper!));
    return [...new Set(names)];
  };

  const choicesFor = (sitting: Sitting, semesterNo: number) => {
    const current = new Set(labelsIn(sitting, semesterNo));
    const open = papers
      .filter((paper) => paper.semesterNo === semesterNo && !placed.has(paper.id))
      .map(subjectLabel);
    return [...new Set([...current, ...open])].sort();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Create Examination Timetable</h2>
            <p className="text-sm text-slate-500">
              Prepare and manage the examination routine with dates, sessions and subjects.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to List
        </button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
            1
          </span>
          <h3 className="font-semibold text-slate-900">Examination Details</h3>
        </header>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          <Detail label="Examination Name" value={exam.name} />
          <Detail label="Academic Year" value={yearName} />
          <Detail label="Examination Month" value={monthName} />
          <Detail label="Examination Type" value={examTypeLabel(exam.examType)} />
          <Detail label="Programme / Course" value={programme} />
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Applicable Semester(s)</p>
            <div className="flex min-h-10 flex-wrap items-center gap-1 rounded-xl border border-slate-200 px-2 py-1">
              {semesters.map((semesterNo) => (
                <button
                  key={semesterNo}
                  type="button"
                  className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800"
                  onClick={() => setHiddenSemesters((rows) => [...rows, semesterNo])}
                  title="Hide this semester column"
                >
                  {ordinal(semesterNo)} Semester ×
                </button>
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-slate-500"
                onClick={() => {
                  const value = window.prompt('Semester number to add');
                  const semesterNo = Number(value);
                  if (!semesterNo || semesterNo < 1 || semesterNo > 12) return;
                  setExtraSemesters((rows) => [...new Set([...rows, semesterNo])]);
                  setHiddenSemesters((rows) => rows.filter((item) => item !== semesterNo));
                }}
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
          </div>
          <Detail label="Shift" value={shiftName} />
          <Detail label="Maximum Marks" value={maxMarks != null ? String(maxMarks) : '—'} />
          <label className="text-xs font-medium text-slate-500">
            Pass Marks
            <input
              type="number"
              min={0}
              value={passMarks}
              onChange={(event) => {
                setDirty(true);
                setPassMarks(event.target.value);
              }}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800"
            />
          </label>
          <label className="text-xs font-medium text-slate-500">
            Exam Duration
            <select
              value={DURATIONS.includes(durationMinutes) ? durationMinutes : 75}
              onChange={(event) => {
                setDirty(true);
                setDurationMinutes(Number(event.target.value));
              }}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800"
            >
              {DURATIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {durationLabel(minutes)}
                </option>
              ))}
            </select>
          </label>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Status</p>
            <span
              className={`inline-flex h-10 items-center rounded-xl px-3 text-sm font-semibold ${published ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}
            >
              {published ? 'Published' : 'Draft'}
              {Number(exam.metadata?.routineRevision) > 1 ? ' · Revised' : ''}
            </span>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">
              2
            </span>
            <h3 className="font-semibold text-slate-900">Timetable Entries</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => addSitting('date')}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Add Exam Date
            </button>
            <button
              type="button"
              onClick={copyLastDate}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 text-xs font-semibold text-blue-700"
            >
              <Copy className="h-3.5 w-3.5" /> Copy from Existing
            </button>
          </div>
        </header>
        <div className="space-y-3 p-4">
          {dateGroups.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">
              Add an examination date, then choose the morning or afternoon subject for each
              semester.
            </p>
          ) : null}
          {dateGroups.map((group) => {
            const closed = closedDates[group.examDate];
            return (
              <article
                key={group.examDate}
                className="overflow-hidden rounded-xl border border-slate-200"
              >
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2">
                  <button
                    type="button"
                    className="flex flex-1 items-center gap-2 text-left text-sm font-semibold text-slate-800"
                    onClick={() =>
                      setClosedDates((rows) => ({ ...rows, [group.examDate]: !closed }))
                    }
                  >
                    {closed ? (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                    <CalendarDays className="h-4 w-4 text-blue-600" />
                    Date: {prettyDate(group.examDate)}
                  </button>
                  <button
                    type="button"
                    className="text-rose-500"
                    onClick={() => removeDate(group.examDate)}
                    title="Remove this date"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {closed ? null : (
                  <div className="space-y-2 p-3">
                    {group.rows.map((sitting) => {
                      const morning = sessionWord(sitting.startTime) === 'Morning';
                      return (
                        <div
                          key={sitting.key}
                          className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-100 bg-white p-3"
                        >
                          <div className="flex items-center gap-2 pb-2">
                            <span
                              className={`flex h-9 w-9 items-center justify-center rounded-full ${morning ? 'bg-amber-100 text-amber-600' : 'bg-orange-100 text-orange-600'}`}
                            >
                              {morning ? (
                                <SunMedium className="h-4 w-4" />
                              ) : (
                                <Sunset className="h-4 w-4" />
                              )}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">
                                {morning ? 'Morning' : 'Afternoon'} Session
                              </p>
                            </div>
                          </div>
                          <label className="text-[11px] font-medium text-slate-500">
                            Start Time
                            <input
                              type="time"
                              value={sitting.startTime}
                              onChange={(event) =>
                                updateSitting(sitting.key, { startTime: event.target.value })
                              }
                              className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-2 text-sm"
                            />
                          </label>
                          <label className="text-[11px] font-medium text-slate-500">
                            End Time
                            <input
                              type="time"
                              value={sitting.endTime}
                              onChange={(event) =>
                                updateSitting(sitting.key, { endTime: event.target.value })
                              }
                              className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-2 text-sm"
                            />
                          </label>
                          {semesters.map((semesterNo) => {
                            const selected = labelsIn(sitting, semesterNo);
                            return (
                              <label
                                key={semesterNo}
                                className="min-w-[150px] flex-1 text-[11px] font-medium text-slate-500"
                              >
                                {ordinal(semesterNo)} Semester
                                <select
                                  value={selected[0] ?? ''}
                                  onChange={(event) =>
                                    setSemesterSubject(sitting.key, semesterNo, event.target.value)
                                  }
                                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-800"
                                >
                                  <option value="">— Select —</option>
                                  {choicesFor(sitting, semesterNo).map((label) => (
                                    <option key={label} value={label}>
                                      {label}
                                    </option>
                                  ))}
                                </select>
                                {selected.length > 1 ? (
                                  <span className="mt-1 block text-[10px] text-blue-700">
                                    {selected.slice(1).join(', ')}
                                  </span>
                                ) : null}
                              </label>
                            );
                          })}
                          <button
                            type="button"
                            className="mb-2 text-rose-500"
                            onClick={() => removeSitting(sitting.key)}
                            title="Remove session"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-xs font-semibold text-amber-700"
                        onClick={() => addSession(group.examDate, 'morning')}
                      >
                        + Morning session
                      </button>
                      <button
                        type="button"
                        className="text-xs font-semibold text-orange-700"
                        onClick={() => addSession(group.examDate, 'afternoon')}
                      >
                        + Afternoon session
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-white">
              <Eye className="h-4 w-4" />
            </span>
            <h3 className="font-semibold text-slate-900">3. Preview Timetable</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={downloadPdf.isPending}
              onClick={() => askExport(() => downloadPdf.mutate())}
              className="inline-flex h-9 items-center rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              Generate PDF
            </button>
            <button
              type="button"
              disabled={downloadExcel.isPending}
              onClick={() => askExport(() => downloadExcel.mutate())}
              className="inline-flex h-9 items-center rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              Export to Excel
            </button>
            <button
              type="button"
              disabled={printSheet.isPending}
              onClick={() => askExport(() => printSheet.mutate())}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
          </div>
        </header>
        <div className="overflow-x-auto p-4">
          <div className="mb-3 text-center">
            <p className="text-base font-bold text-slate-900">Don Bosco College Tura</p>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#1d4f91]">
              {exam.name}
            </p>
            <p className="text-xs font-semibold uppercase text-slate-500">{shiftName}</p>
          </div>
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#163a6b] text-center text-[11px] uppercase text-white">
                <th className="border border-[#163a6b] px-2 py-2" rowSpan={2}>
                  Sl. No.
                </th>
                <th className="border border-[#163a6b] px-2 py-2" rowSpan={2}>
                  Date &amp; Day
                </th>
                <th className="border border-[#163a6b] px-2 py-2" colSpan={semesters.length || 1}>
                  Examinations for the courses to be held
                </th>
              </tr>
              <tr className="bg-[#e7f0fa] text-center text-[11px] font-bold uppercase text-[#163a6b]">
                {semesters.map((semesterNo) => (
                  <th key={semesterNo} className="border border-blue-200 px-2 py-2">
                    {ordinal(semesterNo)} Semester
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dateGroups.map((group, index) => (
                <tr key={group.examDate}>
                  <td className="border border-slate-200 px-2 py-2 text-center font-semibold">
                    {index + 1}
                  </td>
                  <td className="border border-slate-200 px-2 py-2 text-center">
                    <div className="font-semibold">
                      {group.examDate.split('-').reverse().join('-')}
                    </div>
                    <div className="text-xs text-slate-500">{weekday(group.examDate)}</div>
                  </td>
                  {semesters.map((semesterNo) => (
                    <td
                      key={semesterNo}
                      className="border border-slate-200 px-2 py-2 text-center text-[#1d4f91]"
                    >
                      {group.rows.map((sitting) => {
                        const labels = labelsIn(sitting, semesterNo);
                        return (
                          <div key={sitting.key} className="py-1">
                            <div className="text-[11px] font-semibold uppercase">
                              {sessionWord(sitting.startTime)} {clock12(sitting.startTime)} –{' '}
                              {clock12(sitting.endTime)}
                            </div>
                            <div className="font-bold">
                              {labels.length ? labels.join(' / ') : '—'}
                            </div>
                          </div>
                        );
                      })}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-rose-200 bg-rose-50/60 shadow-sm">
        <header className="flex items-center gap-2 px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 text-xs font-bold text-white">
            4
          </span>
          <h3 className="font-semibold text-slate-900">Examination Instructions</h3>
        </header>
        <div className="px-4 pb-4">
          <textarea
            value={instructions}
            onChange={(event) => {
              setDirty(true);
              setInstructions(event.target.value);
            }}
            rows={5}
            placeholder={
              'The Admit Card will be issued from 8th October 2026. Kindly, bring your fee book.\nSyllabus for the test: Classes taken after the 1st Internal Assessment to till date.\nTotal marks – 15 and the Duration of Exam: 1 hour 15 minutes.\nNEHU Question pattern to be followed.'
            }
            className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-slate-800"
          />
          {instructionLines.length ? (
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
              {instructionLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          ) : null}
        </div>
      </section>

      {warnings.length ? (
        <ul className="space-y-1 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => {
            if (
              exam.status !== 'DRAFT' &&
              !window.confirm(
                'Saving as draft hides this routine from students until you publish it again.',
              )
            )
              return;
            save.mutate({ publish: false });
          }}
          className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          Save as Draft
        </button>
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => {
            if (
              exam.status !== 'DRAFT' &&
              !window.confirm('Publish this revision? Students will see the updated routine.')
            )
              return;
            save.mutate({ publish: true });
          }}
          className="inline-flex h-10 items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          Publish Routine
        </button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-800">
        {value}
      </div>
    </div>
  );
}
