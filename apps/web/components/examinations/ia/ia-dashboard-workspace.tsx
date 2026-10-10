'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  GraduationCap,
  Hourglass,
  IdCard,
  PenLine,
  Plus,
  Settings,
  Upload,
  Users,
  Zap,
} from 'lucide-react';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { useExamHeaderAside } from '@/components/examinations/ia/ia-examination-shell';
import {
  fetchIaAdminDashboard,
  fetchIaExams,
  fetchIaPapers,
  type IaPaper,
} from '@/services/examinations-ia';
import { cn } from '@/utils/cn';

const BASE = '/admin/academics/examinations';
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BAR_COLORS = [
  'bg-blue-500',
  'bg-teal-500',
  'bg-amber-500',
  'bg-slate-300',
  'bg-rose-300',
  'bg-violet-400',
];

function isoDate(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function parts(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

function weekday(iso: string) {
  const { year, month, day } = parts(iso);
  if (!year || !month || !day) return '—';
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? '—';
}

function displayDate(iso: string) {
  const { year, month, day } = parts(iso);
  if (!year || !month || !day) return '—';
  return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
}

function prettyDate(iso: string) {
  const { year, month, day } = parts(iso);
  if (!year || !month || !day) return '—';
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function shortName(name: string) {
  const trimmed = name.replace(/^FYUGP\s+/i, '').replace(/\s+internal assessment\s+/i, ' IA ');
  return trimmed.length > 22 ? `${trimmed.slice(0, 20)}…` : trimmed;
}

function monthLabel(iso: string) {
  const { month, year } = parts(iso);
  if (!month || !year) return '';
  return `${MONTHS[month - 1]} ${year}`;
}

function dayStamp(iso: string) {
  const { month, day } = parts(iso);
  if (!month || !day) return { day: '—', month: '' };
  return { day: String(day).padStart(2, '0'), month: MONTHS[month - 1].toUpperCase() };
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function daysUntil(iso: string) {
  const { year, month, day } = parts(iso);
  const { year: ty, month: tm, day: td } = parts(todayIso());
  const target = Date.UTC(year, month - 1, day);
  const today = Date.UTC(ty, tm - 1, td);
  return Math.round((target - today) / 86400000);
}

function clock24(value: string | Date | null | undefined) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const match = value.match(/T(\d{2}):(\d{2})/) ?? value.match(/^(\d{1,2}):(\d{2})/);
    if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

function clock12(value: string | Date | null | undefined) {
  const raw = clock24(value);
  if (!raw) return '—';
  const [hours, minutes] = raw.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function shiftFromClock(value: string | Date | null | undefined) {
  const raw = clock24(value);
  if (!raw) return '—';
  return Number(raw.slice(0, 2)) < 12 ? 'Morning' : 'Afternoon';
}

function statusTone(status: string) {
  if (status === 'SCHEDULED' || status === 'ACTIVE' || status === 'IN_PROGRESS')
    return 'bg-blue-50 text-blue-700';
  if (status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'EXPIRED' || status === 'CANCELLED') return 'bg-rose-50 text-rose-600';
  return 'bg-amber-50 text-amber-700';
}

export function IaDashboardWorkspace() {
  const exams = useQuery({ queryKey: ['ia', 'exams'], queryFn: fetchIaExams });
  const dashboard = useQuery({ queryKey: ['ia', 'dashboard'], queryFn: fetchIaAdminDashboard });
  const [yearId, setYearId] = useState('all');
  const yearTouched = useRef(false);

  const yearOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const exam of exams.data ?? []) {
      if (exam.academicYearId)
        map.set(exam.academicYearId, exam.stats?.academicYearName || exam.academicYearId);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [exams.data]);

  useEffect(() => {
    if (yearTouched.current || yearId !== 'all' || !exams.data?.length) return;
    const preferred = exams.data.find((exam) => exam.status === 'SCHEDULED') ?? exams.data[0];
    if (preferred?.academicYearId) setYearId(preferred.academicYearId);
  }, [exams.data, yearId]);

  const yearExams = useMemo(
    () =>
      (exams.data ?? []).filter(
        (exam) => yearId === 'all' || !exam.academicYearId || exam.academicYearId === yearId,
      ),
    [exams.data, yearId],
  );

  const currentExam = useMemo(() => {
    const today = todayIso();
    return (
      yearExams.find(
        (exam) =>
          exam.status === 'SCHEDULED' &&
          isoDate(exam.startDate) <= today &&
          isoDate(exam.endDate || exam.startDate) >= today,
      ) ??
      yearExams.find((exam) => exam.status === 'SCHEDULED') ??
      yearExams.find((exam) => exam.status === 'DRAFT') ??
      yearExams[0] ??
      null
    );
  }, [yearExams]);

  const papers = useQuery({
    queryKey: ['ia', 'papers', currentExam?.id],
    queryFn: () => fetchIaPapers({ sessionId: currentExam!.id }),
    enabled: Boolean(currentExam?.id),
  });

  const registered = yearExams.reduce(
    (sum, exam) => sum + (exam.stats?.registeredStudents ?? 0),
    0,
  );
  const subjects = yearExams.reduce((sum, exam) => sum + (exam.stats?.subjectsScheduled ?? 0), 0);
  const marksEntered = yearExams.reduce((sum, exam) => sum + (exam.stats?.marksEntered ?? 0), 0);
  const marksPending = yearExams.reduce((sum, exam) => sum + (exam.stats?.marksPending ?? 0), 0);
  const markTotal = marksEntered + marksPending;
  const completedPercent = markTotal ? Math.round((marksEntered / markTotal) * 1000) / 10 : 0;
  const defaulters = Number(dashboard.data?.summary?.defaulters ?? 0);
  const eligible = Math.max(registered - (Number.isFinite(defaulters) ? defaulters : 0), 0);
  const datedPapers = (papers.data ?? []).filter((paper) => isoDate(paper.examDate)).length;
  const undatedPapers = Math.max((papers.data ?? []).length - datedPapers, 0);

  const semesters = [
    ...new Set(yearExams.flatMap((exam) => exam.stats?.semesterNos ?? []).filter((n) => n != null)),
  ];
  const shifts = [
    ...new Set(
      yearExams
        .map((exam) => exam.stats?.shiftName || exam.metadata?.shiftName)
        .filter((name): name is string => Boolean(name)),
    ),
  ];
  const streamNames = [
    ...new Set(
      yearExams
        .map((exam) => exam.stats?.streamName)
        .filter((name): name is string => Boolean(name) && name !== 'All Streams'),
    ),
  ];

  const today = todayIso();
  const recent = [...yearExams]
    .sort((a, b) => isoDate(b.startDate).localeCompare(isoDate(a.startDate)))
    .slice(0, 5);
  const upcoming = yearExams
    .filter((exam) => exam.status !== 'CANCELLED' && exam.status !== 'EXPIRED')
    .map((exam) => ({ exam, start: isoDate(exam.startDate), end: isoDate(exam.endDate) }))
    .filter((row) => row.start && (row.end || row.start) >= today)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 4);

  const overview = [...(papers.data ?? [])]
    .filter((paper) => isoDate(paper.examDate))
    .sort(
      (a, b) =>
        isoDate(a.examDate).localeCompare(isoDate(b.examDate)) ||
        clock24(a.startTime).localeCompare(clock24(b.startTime)) ||
        a.paperCode.localeCompare(b.paperCode),
    )
    .slice(0, 6);

  const setHeaderAside = useExamHeaderAside();
  const yearControl = useMemo(
    () => (
      <YearSelect
        yearId={yearId}
        years={yearOptions}
        onChange={(value) => {
          yearTouched.current = true;
          setYearId(value);
        }}
      />
    ),
    [yearId, yearOptions],
  );
  useLayoutEffect(() => {
    if (!setHeaderAside) return;
    setHeaderAside(yearControl);
    return () => setHeaderAside(null);
  }, [setHeaderAside, yearControl]);

  if (exams.isLoading)
    return <p className="text-sm text-slate-500">Loading the examination dashboard…</p>;
  if (exams.isError) {
    return (
      <QueryErrorPanel
        title="Unable to load the examination dashboard"
        error={exams.error}
        onRetry={() => void exams.refetch()}
        isRetrying={exams.isFetching}
      />
    );
  }

  return (
    <div className="space-y-4">
      {setHeaderAside ? null : <div className="flex justify-end">{yearControl}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Stat
          icon={<FileText className="h-5 w-5" />}
          tone="blue"
          label="Total IA Exams"
          value={yearExams.length}
          hint="All internal assessments"
        />
        <Stat
          icon={<Users className="h-5 w-5" />}
          tone="green"
          label="Registered Students"
          value={registered}
          hint="Across these examinations"
        />
        <Stat
          icon={<GraduationCap className="h-5 w-5" />}
          tone="violet"
          label="Eligible Students"
          value={eligible}
          hint="After defaulters are removed"
        />
        <Stat
          icon={<CalendarDays className="h-5 w-5" />}
          tone="amber"
          label="Subjects Scheduled"
          value={subjects}
          hint="For this academic year"
        />
        <Stat
          icon={<Hourglass className="h-5 w-5" />}
          tone="rose"
          label="Marks Pending"
          value={marksPending}
          hint="To be entered"
        />
        <Stat
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="emerald"
          label="Marks Completed"
          value={marksEntered}
          hint={`${completedPercent}% completed`}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-3">
        <Panel
          title="Examination Progress"
          icon={<BarChart3 className="h-4 w-4 text-blue-600" />}
          extra={
            <YearSelect
              compact
              yearId={yearId}
              years={yearOptions}
              onChange={(value) => {
                yearTouched.current = true;
                setYearId(value);
              }}
            />
          }
        >
          <p className="mb-3 text-xs text-slate-500">
            Marks entry progress for all IA examinations.
          </p>
          <div className="flex gap-2">
            <div className="flex h-32 flex-col justify-between text-[10px] text-slate-400">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>
            <div className="flex h-40 min-w-0 flex-1 items-end gap-2">
              {yearExams.length ? (
                yearExams.map((exam, index) => {
                  const percent = exam.stats?.completionPercent ?? 0;
                  return (
                    <div
                      key={exam.id}
                      className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                    >
                      <span className="text-[11px] font-semibold text-slate-700">{percent}%</span>
                      <div className="flex h-32 w-full items-end justify-center">
                        <div
                          className={cn(
                            'w-9 max-w-full rounded-t-md',
                            BAR_COLORS[index % BAR_COLORS.length],
                          )}
                          style={{ height: `${Math.max(percent, 4)}%` }}
                          title={exam.name}
                        />
                      </div>
                      <p
                        className="w-full truncate text-center text-[10px] font-medium text-slate-600"
                        title={exam.name}
                      >
                        {shortName(exam.name)}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {monthLabel(isoDate(exam.startDate))}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">No internal assessments in this year.</p>
              )}
            </div>
          </div>
        </Panel>

        <Panel
          title="Recent IA Examinations"
          icon={<ClipboardList className="h-4 w-4 text-blue-600" />}
          extra={
            <Link href={`${BASE}/ia-exams`} className="text-xs font-medium text-blue-600">
              View All →
            </Link>
          }
        >
          <ul className="divide-y divide-slate-100">
            {recent.map((exam) => (
              <li key={exam.id} className="flex items-start gap-3 py-2.5">
                <span className={cn('mt-0.5 rounded-lg p-2', statusTone(exam.status))}>
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{exam.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {exam.examType.replace(/_/g, ' ')} · {exam.stats?.registeredStudents ?? 0}{' '}
                    students · {exam.stats?.subjectsScheduled ?? 0} subjects
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      statusTone(exam.status),
                    )}
                  >
                    {exam.status}
                  </span>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {prettyDate(isoDate(exam.startDate))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Upcoming Schedule"
          icon={<CalendarDays className="h-4 w-4 text-blue-600" />}
          extra={
            <Link href={`${BASE}/timetable`} className="text-xs font-medium text-blue-600">
              View All →
            </Link>
          }
        >
          <ul className="space-y-3">
            {upcoming.length ? (
              upcoming.map(({ exam, start, end }) => {
                const left = daysUntil(start);
                const stamp = dayStamp(start);
                const within = left <= 0 && (end || start) >= todayIso();
                return (
                  <li key={exam.id} className="flex items-center gap-3">
                    <div className="w-12 rounded-xl bg-blue-50 py-1.5 text-center text-blue-700">
                      <p className="text-sm font-bold leading-none">{stamp.day}</p>
                      <p className="text-[10px] font-semibold">{stamp.month}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{exam.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {exam.examType.replace(/_/g, ' ')} ·{' '}
                        {exam.stats?.shiftName || exam.metadata?.shiftName || 'All shifts'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-medium',
                        within
                          ? 'bg-emerald-50 text-emerald-700'
                          : left < 0
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-amber-50 text-amber-700',
                      )}
                    >
                      {within
                        ? 'In progress'
                        : left === 0
                          ? 'Today'
                          : left === 1
                            ? '1 day left'
                            : left > 1
                              ? `${left} days left`
                              : 'Started'}
                    </span>
                  </li>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">No upcoming internal assessment.</p>
            )}
          </ul>
        </Panel>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Zap className="h-4 w-4 text-amber-500" /> Quick Actions
          </h2>
          <p className="text-xs text-slate-500">Frequently used examination tasks.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Action
            href={`${BASE}/ia-exams`}
            icon={<Plus className="h-4 w-4" />}
            className="bg-blue-600 text-white"
          >
            Create New IA Exam
          </Action>
          <Action
            href={`${BASE}/timetable`}
            icon={<CalendarDays className="h-4 w-4" />}
            className="bg-sky-50 text-sky-700"
          >
            View Timetable
          </Action>
          <Action
            href={`${BASE}/admit-cards`}
            icon={<IdCard className="h-4 w-4" />}
            className="bg-emerald-50 text-emerald-700"
          >
            Generate Admit Cards
          </Action>
          <Action
            href={`${BASE}/mark-entry`}
            icon={<PenLine className="h-4 w-4" />}
            className="bg-amber-50 text-amber-700"
          >
            Enter Marks
          </Action>
          <Action
            href={`${BASE}/mark-entry`}
            icon={<Upload className="h-4 w-4" />}
            className="bg-violet-50 text-violet-700"
          >
            Import Marks (CSV)
          </Action>
          <Action
            href={`${BASE}/reports`}
            icon={<BarChart3 className="h-4 w-4" />}
            className="bg-rose-50 text-rose-600"
          >
            Export Reports
          </Action>
          <Action
            href={`${BASE}/settings`}
            icon={<Settings className="h-4 w-4" />}
            className="bg-slate-50 text-slate-700"
          >
            Settings
          </Action>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <Panel
          title="Timetable Overview (Current IA Exam)"
          icon={<CalendarDays className="h-4 w-4 text-blue-600" />}
          extra={
            <Link
              href={`${BASE}/timetable${currentExam ? `?exam=${currentExam.id}` : ''}`}
              className="text-xs font-medium text-blue-600"
            >
              View Full Timetable →
            </Link>
          }
        >
          <p className="mb-2 text-xs text-slate-500">
            {currentExam ? currentExam.name : 'Current IA exam'}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Day</th>
                  <th className="py-2 pr-3">Shift</th>
                  <th className="py-2 pr-3">Subject / Paper</th>
                  <th className="py-2 pr-3">Sem</th>
                  <th className="py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {overview.map((paper) => (
                  <OverviewRow key={paper.id} paper={paper} />
                ))}
              </tbody>
            </table>
            {!overview.length ? (
              <p className="py-6 text-sm text-slate-500">
                {papers.isLoading
                  ? 'Loading the timetable…'
                  : 'This examination has no dated papers yet.'}
              </p>
            ) : null}
          </div>
        </Panel>

        <Panel
          title="Examination Statistics"
          icon={<BarChart3 className="h-4 w-4 text-blue-600" />}
          extra={
            <YearSelect
              compact
              yearId={yearId}
              years={yearOptions}
              onChange={(value) => {
                yearTouched.current = true;
                setYearId(value);
              }}
            />
          }
        >
          <div className="flex flex-wrap items-center gap-5">
            <Donut entered={marksEntered} pending={marksPending} subjects={subjects} />
            <ul className="space-y-2 text-sm">
              <Legend
                color="bg-emerald-500"
                label="Marks entered"
                value={marksEntered}
                percent={completedPercent}
              />
              <Legend
                color="bg-amber-400"
                label="Pending"
                value={marksPending}
                percent={markTotal ? Math.round((marksPending / markTotal) * 1000) / 10 : 0}
              />
              {undatedPapers > 0 ? (
                <Legend
                  color="bg-rose-500"
                  label="Undated papers"
                  value={undatedPapers}
                  percent={
                    (papers.data ?? []).length
                      ? Math.round((undatedPapers / (papers.data ?? []).length) * 1000) / 10
                      : 0
                  }
                />
              ) : null}
            </ul>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Mini
              icon={<Building2 className="h-4 w-4" />}
              label="Departments"
              value={dashboard.data?.departments?.length ?? '—'}
            />
            <Mini
              icon={<GraduationCap className="h-4 w-4" />}
              label="Semesters"
              value={semesters.length || '—'}
            />
            <Mini
              icon={<Users className="h-4 w-4" />}
              label="Streams"
              value={streamNames.length ? streamNames.length : 'All'}
            />
            <Mini
              icon={<Clock3 className="h-4 w-4" />}
              label="Shifts"
              value={shifts.length || 'All'}
            />
          </div>
        </Panel>
      </section>
    </div>
  );
}

function OverviewRow({ paper }: { paper: IaPaper }) {
  const date = isoDate(paper.examDate);
  const shift = shiftFromClock(paper.startTime);
  return (
    <tr className="border-t border-slate-100">
      <td className="py-2 pr-3 text-slate-700">{displayDate(date)}</td>
      <td className="py-2 pr-3 text-slate-600">{weekday(date)}</td>
      <td className="py-2 pr-3">
        <span
          className={cn(
            'text-xs font-medium',
            shift === 'Morning' ? 'text-amber-600' : 'text-blue-600',
          )}
        >
          {shift}
        </span>
      </td>
      <td className="py-2 pr-3 text-slate-800">
        {paper.paperCode} — {paper.paperName}
      </td>
      <td className="py-2 pr-3">{paper.semesterNo ?? '—'}</td>
      <td className="py-2 text-slate-600">
        {clock12(paper.startTime)} – {clock12(paper.endTime)}
      </td>
    </tr>
  );
}

function YearSelect({
  yearId,
  years,
  onChange,
  compact = false,
}: {
  yearId: string;
  years: Array<{ id: string; name: string }>;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm',
        compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-2 text-xs',
      )}
    >
      <CalendarDays className="h-4 w-4 text-blue-600" />
      Academic Year
      <select
        value={yearId}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent font-semibold text-slate-800 outline-none"
      >
        <option value="all">All</option>
        {years.map((year) => (
          <option key={year.id} value={year.id}>
            {year.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Spark({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 48 28" className="h-7 w-12 shrink-0" aria-hidden>
      <rect x="2" y="16" width="6" height="10" rx="1.5" fill={color} opacity="0.35" />
      <rect x="14" y="10" width="6" height="16" rx="1.5" fill={color} opacity="0.55" />
      <rect x="26" y="13" width="6" height="13" rx="1.5" fill={color} opacity="0.4" />
      <rect x="38" y="4" width="6" height="22" rx="1.5" fill={color} />
    </svg>
  );
}

function Stat({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  tone: 'blue' | 'green' | 'violet' | 'amber' | 'rose' | 'emerald';
  label: string;
  value: number;
  hint: string;
}) {
  const tones = {
    blue: { card: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', bar: '#3b82f6' },
    green: { card: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', bar: '#10b981' },
    violet: { card: 'bg-violet-50', icon: 'bg-violet-100 text-violet-600', bar: '#8b5cf6' },
    amber: { card: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600', bar: '#f59e0b' },
    rose: { card: 'bg-rose-50', icon: 'bg-rose-100 text-rose-500', bar: '#f43f5e' },
    emerald: { card: 'bg-green-50', icon: 'bg-green-100 text-green-600', bar: '#22c55e' },
  };
  const toneStyle = tones[tone];
  return (
    <article className={cn('rounded-2xl border border-white/80 p-3 shadow-sm', toneStyle.card)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <div className={cn('rounded-xl p-2', toneStyle.icon)}>{icon}</div>
          <div>
            <p className="text-[11px] text-slate-500">{label}</p>
            <p className="text-xl font-bold text-slate-900">{value.toLocaleString('en-IN')}</p>
          </div>
        </div>
        <Spark color={toneStyle.bar} />
      </div>
      <p className="mt-2 text-[10px] text-slate-400">{hint}</p>
    </article>
  );
}

function Panel({
  title,
  icon,
  extra,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          {icon}
          {title}
        </h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Action({
  href,
  icon,
  className,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium',
        className,
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

function Donut({
  entered,
  pending,
  subjects,
}: {
  entered: number;
  pending: number;
  subjects: number;
}) {
  const total = entered + pending;
  const enteredDeg = total ? (entered / total) * 360 : 0;
  return (
    <div
      className="relative h-36 w-36 shrink-0 rounded-full"
      style={{
        background: total
          ? `conic-gradient(#22c55e 0deg ${enteredDeg}deg, #fbbf24 ${enteredDeg}deg 360deg)`
          : '#e2e8f0',
      }}
    >
      <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white text-center">
        <p className="text-xl font-bold text-slate-900">{subjects.toLocaleString('en-IN')}</p>
        <p className="text-[10px] text-slate-400">Subjects</p>
      </div>
    </div>
  );
}

function Legend({
  color,
  label,
  value,
  percent,
}: {
  color: string;
  label: string;
  value: number;
  percent: number;
}) {
  return (
    <li className="flex items-center gap-2">
      <span className={cn('h-2.5 w-2.5 rounded-full', color)} />
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-800">
        {value.toLocaleString('en-IN')} ({percent}%)
      </span>
    </li>
  );
}

function Mini({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2 text-center">
      <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-lg bg-white text-blue-600">
        {icon}
      </div>
      <p className="text-sm font-bold text-slate-800">{value}</p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  );
}
