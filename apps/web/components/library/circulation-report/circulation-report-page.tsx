'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  BookUp,
  CalendarClock,
  FileSpreadsheet,
  FileText,
  Filter,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Timer,
  X,
} from 'lucide-react';
import { useMemo, useState, type ComponentType } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { fetchLibraryMembers } from '@/services/library';
import {
  downloadCirculationReport,
  fetchCirculationAnalytics,
  fetchCirculationOptions,
  fetchCirculationRows,
  fetchCirculationSummary,
} from '@/services/library-circulation-report';
import type { CirculationFilters, CirculationReportKey } from '@/types/library-circulation-report';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { downloadBlob } from '@/utils/download-blob';
import { CirculationReportCharts } from './circulation-report-charts';
import { CirculationReportTable, fmtDate } from './circulation-report-table';

const TABS: { id: CirculationReportKey; label: string }[] = [
  { id: 'all', label: 'All Transactions' },
  { id: 'issued', label: 'Issued' },
  { id: 'renewed', label: 'Renewed' },
  { id: 'returned', label: 'Returned' },
  { id: 'current', label: 'Currently Borrowed' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'late', label: 'Late Returns' },
  { id: 'borrower', label: 'Borrower-wise' },
  { id: 'departments', label: 'Department-wise' },
  { id: 'librarians', label: 'Librarian-wise' },
  { id: 'lost-damaged', label: 'Lost & Damaged' },
];

const QUICK = [
  { id: 'today', label: 'Today', days: 1 },
  { id: '7', label: 'Last 7 Days', days: 7 },
  { id: '30', label: 'Last 30 Days', days: 30 },
  { id: '90', label: 'Last 90 Days', days: 90 },
  { id: '180', label: 'Last 180 Days', days: 180 },
  { id: '365', label: 'Last 365 Days', days: 365 },
  { id: 'all', label: 'All Time', days: 0 },
  { id: 'custom', label: 'Custom Range', days: 0 },
] as const;
type QuickId = (typeof QUICK)[number]['id'];

const STATUS_OPTIONS = [
  ['ON_LOAN', 'On loan'],
  ['OVERDUE', 'Overdue'],
  ['RENEWED', 'Renewed'],
  ['RETURNED', 'Returned'],
  ['RETURNED_LATE', 'Returned late'],
  ['RETURNED_DAMAGED', 'Returned damaged'],
  ['LOST', 'Lost'],
] as const;

function collegeToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function shiftDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const selectClass = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm';

type TextFilters = { borrower: string; bookTitle: string; accession: string };

export function CirculationReportPage() {
  const enabled = useAuthQueryEnabled();
  const [report, setReport] = useState<CirculationReportKey>('all');
  const [quick, setQuick] = useState<QuickId>('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCharts, setShowCharts] = useState(true);
  const [analyticsYear, setAnalyticsYear] = useState<'range' | number>('range');
  const [select, setSelect] = useState<{
    semester?: number;
    departmentId?: string;
    memberType?: string;
    type?: 'ISSUE' | 'RENEW' | 'RETURN';
    status?: string;
    processedById?: string;
  }>({});
  const [text, setText] = useState<TextFilters>({ borrower: '', bookTitle: '', accession: '' });
  const [search, setSearch] = useState('');
  const [member, setMember] = useState<{ id: string; label: string } | null>(null);
  const [memberQuery, setMemberQuery] = useState('');
  const [sort, setSort] = useState<{ sortBy?: string; sortDir?: 'asc' | 'desc' }>({});
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [exporting, setExporting] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const debouncedText = useDebouncedValue(text, 350);
  const debouncedSearch = useDebouncedValue(search, 350);
  const debouncedMember = useDebouncedValue(memberQuery, 300);

  const range = useMemo(() => {
    const today = collegeToday();
    if (quick === 'custom') return { from: customFrom || undefined, to: customTo || undefined };
    if (academicYearId) return { from: undefined, to: undefined };
    if (quick === 'all') return { from: '2000-01-01', to: today };
    const days = QUICK.find((q) => q.id === quick)?.days ?? 30;
    return { from: shiftDays(today, -(days - 1)), to: today };
  }, [quick, customFrom, customTo, academicYearId]);

  const shared: CirculationFilters = useMemo(
    () => ({
      ...range,
      academicYearId: academicYearId || undefined,
      ...select,
      borrower: debouncedText.borrower.trim() || undefined,
      bookTitle: debouncedText.bookTitle.trim() || undefined,
      accession: debouncedText.accession.trim() || undefined,
      memberId: report === 'borrower' ? member?.id : undefined,
    }),
    [range, academicYearId, select, debouncedText, report, member],
  );

  const tableFilters: CirculationFilters = useMemo(
    () => ({
      ...shared,
      report,
      search: debouncedSearch.trim() || undefined,
      ...sort,
      page,
      limit,
    }),
    [shared, report, debouncedSearch, sort, page, limit],
  );

  const optionsQ = useQuery({
    queryKey: ['library', 'circulation-report', 'options'],
    queryFn: fetchCirculationOptions,
    enabled,
  });
  const summaryQ = useQuery({
    queryKey: ['library', 'circulation-report', 'summary', shared],
    queryFn: () => fetchCirculationSummary(shared),
    enabled,
    placeholderData: keepPreviousData,
  });
  const rowsQ = useQuery({
    queryKey: ['library', 'circulation-report', 'rows', tableFilters],
    queryFn: () => fetchCirculationRows(tableFilters),
    enabled: enabled && (report !== 'borrower' || Boolean(member)),
    placeholderData: keepPreviousData,
  });
  const analyticsQ = useQuery({
    queryKey: [
      'library',
      'circulation-report',
      'analytics',
      analyticsYear,
      summaryQ.data?.range,
      select.departmentId,
      select.memberType,
    ],
    queryFn: () =>
      fetchCirculationAnalytics({
        ...(analyticsYear === 'range'
          ? { from: summaryQ.data?.range.from, to: summaryQ.data?.range.to }
          : { year: analyticsYear }),
        departmentId: select.departmentId,
        memberType: select.memberType,
      }),
    enabled: enabled && showCharts && (analyticsYear !== 'range' || Boolean(summaryQ.data)),
  });
  const memberHits = useQuery({
    queryKey: ['library', 'members', 'circulation-report', debouncedMember],
    queryFn: () => fetchLibraryMembers({ search: debouncedMember, limit: 8 }),
    enabled: enabled && report === 'borrower' && debouncedMember.trim().length > 1,
  });

  const s = summaryQ.data;
  const options = optionsQ.data;
  const openTab = (id: CirculationReportKey) => {
    setReport(id);
    setPage(1);
    setSort({});
  };

  const cards: {
    label: string;
    value?: number;
    hint: string;
    icon: ComponentType<{ className?: string }>;
    tone: string;
    onClick: () => void;
  }[] = [
    {
      label: 'Total Issues',
      value: s?.totalIssues,
      hint: s ? `${s.issuedCopies} distinct copies` : '',
      icon: BookUp,
      tone: 'bg-blue-50 text-blue-700',
      onClick: () => openTab('issued'),
    },
    {
      label: 'Total Renewals',
      value: s?.totalRenewals,
      hint: s ? `${s.renewedCopies} distinct copies` : '',
      icon: RefreshCw,
      tone: 'bg-violet-50 text-violet-700',
      onClick: () => openTab('renewed'),
    },
    {
      label: 'Total Returns',
      value: s?.totalReturns,
      hint: s ? `${s.returnedCopies} distinct copies` : '',
      icon: RotateCcw,
      tone: 'bg-emerald-50 text-emerald-700',
      onClick: () => openTab('returned'),
    },
    {
      label: 'Currently Borrowed',
      value: s?.currentlyBorrowed,
      hint: s ? `Active loans as of ${fmtDate(s.range.asOf)}` : '',
      icon: BookOpen,
      tone: 'bg-sky-50 text-sky-700',
      onClick: () => openTab('current'),
    },
    {
      label: 'Overdue Books',
      value: s?.overdue,
      hint: 'Past due, not returned',
      icon: AlertTriangle,
      tone: 'bg-rose-50 text-rose-700',
      onClick: () => openTab('overdue'),
    },
    {
      label: 'Late Returns',
      value: s?.lateReturns,
      hint: 'Returned after the due date',
      icon: Timer,
      tone: 'bg-amber-50 text-amber-800',
      onClick: () => openTab('late'),
    },
    {
      label: "Today's Issues",
      value: s?.todayIssues,
      hint: 'Issue transactions today',
      icon: CalendarClock,
      tone: 'bg-slate-100 text-slate-700',
      onClick: () => {
        setAcademicYearId('');
        setQuick('today');
        openTab('issued');
      },
    },
    {
      label: "Today's Returns",
      value: s?.todayReturns,
      hint: 'Return transactions today',
      icon: CalendarClock,
      tone: 'bg-slate-100 text-slate-700',
      onClick: () => {
        setAcademicYearId('');
        setQuick('today');
        openTab('returned');
      },
    },
  ];

  const exportFile = async (format: 'xlsx' | 'csv' | 'pdf', print = false) => {
    setExporting(print ? 'print' : format);
    setMessage('');
    try {
      const filters = { ...tableFilters, page: undefined, limit: undefined };
      const blob = await downloadCirculationReport(format, filters);
      const rangeLabel = `${s?.range.from ?? 'from'}-to-${s?.range.to ?? 'to'}`;
      if (print) {
        const url = URL.createObjectURL(blob);
        const opened = window.open(url, '_blank');
        if (!opened) setMessage('Allow pop-up windows to open the printable report.');
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        downloadBlob(blob, `library-circulation-${report}-${rangeLabel}.${format}`);
      }
    } catch (error) {
      setMessage(apiErrorMessage(error, 'Could not generate the report'));
    } finally {
      setExporting(null);
    }
  };

  const resetFilters = () => {
    setSelect({});
    setText({ borrower: '', bookTitle: '', accession: '' });
    setSearch('');
    setPage(1);
  };

  const activeFilterCount =
    Object.values(select).filter(Boolean).length +
    Object.values(text).filter((v) => v.trim()).length;

  const rows = rowsQ.data;
  const paged = rows && 'totalPages' in rows ? rows : null;
  const currentYear = Number(collegeToday().slice(0, 4));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            Library Circulation Report
          </h1>
          <p className="text-sm text-slate-500">
            Issues, renewals and returns from the circulation history
            {s ? ` · ${fmtDate(s.range.from)} to ${fmtDate(s.range.to)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={Boolean(exporting)}
            onClick={() => void exportFile('xlsx')}
          >
            <FileSpreadsheet className="mr-1 h-4 w-4" />{' '}
            {exporting === 'xlsx' ? 'Preparing…' : 'Excel'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={Boolean(exporting)}
            onClick={() => void exportFile('csv')}
          >
            <FileText className="mr-1 h-4 w-4" /> {exporting === 'csv' ? 'Preparing…' : 'CSV'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={Boolean(exporting)}
            onClick={() => void exportFile('pdf')}
          >
            <FileText className="mr-1 h-4 w-4" /> {exporting === 'pdf' ? 'Preparing…' : 'PDF'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={Boolean(exporting)}
            onClick={() => void exportFile('pdf', true)}
          >
            <Printer className="mr-1 h-4 w-4" /> {exporting === 'print' ? 'Preparing…' : 'Print'}
          </Button>
        </div>
      </div>

      <section className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => {
                setQuick(q.id);
                setPage(1);
                if (q.id !== 'custom') setAcademicYearId('');
              }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium',
                quick === q.id && !academicYearId
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50',
              )}
            >
              {q.label}
            </button>
          ))}
        </div>
        {quick === 'custom' ? (
          <div className="flex items-end gap-2">
            <label className="text-xs text-slate-500">
              From
              <Input
                type="date"
                className="mt-0.5 h-9 w-40"
                value={customFrom}
                onChange={(e) => {
                  setCustomFrom(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="text-xs text-slate-500">
              To
              <Input
                type="date"
                className="mt-0.5 h-9 w-40"
                value={customTo}
                onChange={(e) => {
                  setCustomTo(e.target.value);
                  setPage(1);
                }}
              />
            </label>
          </div>
        ) : null}
        <label className="ml-auto min-w-[180px] text-xs text-slate-500">
          Academic Year
          <select
            className={cn(selectClass, 'mt-0.5')}
            value={academicYearId}
            onChange={(e) => {
              setAcademicYearId(e.target.value);
              if (e.target.value && quick !== 'custom') setQuick('30');
              setPage(1);
            }}
          >
            <option value="">Not limited</option>
            {(options?.academicYears ?? []).map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {summaryQ.isError ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {apiErrorMessage(summaryQ.error, 'Could not load the circulation summary')}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={card.onClick}
            className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                  {card.value == null ? '—' : card.value.toLocaleString()}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{card.hint}</p>
              </div>
              <span
                className={cn('flex h-9 w-9 items-center justify-center rounded-xl', card.tone)}
              >
                <card.icon className="h-4 w-4" />
              </span>
            </div>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Issues, renewals and returns count transactions in the selected period. A renewal is never
        counted as an issue. Currently borrowed and overdue count distinct active loans at the end
        of the period.
      </p>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800"
            onClick={() => setShowCharts((v) => !v)}
          >
            <BarChart3 className="h-4 w-4" /> Circulation analytics{' '}
            {showCharts ? '(hide)' : '(show)'}
          </button>
          {showCharts ? (
            <select
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"
              value={String(analyticsYear)}
              onChange={(e) =>
                setAnalyticsYear(e.target.value === 'range' ? 'range' : Number(e.target.value))
              }
              aria-label="Analytics period"
            >
              <option value="range">Selected date range</option>
              {[0, 1, 2, 3].map((back) => (
                <option key={back} value={currentYear - back}>
                  Year {currentYear - back}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        {showCharts ? (
          analyticsQ.data ? (
            <CirculationReportCharts data={analyticsQ.data} />
          ) : analyticsQ.isError ? (
            <p className="text-sm text-rose-600">
              {apiErrorMessage(analyticsQ.error, 'Could not load charts')}
            </p>
          ) : (
            <p className="text-sm text-slate-500">Loading charts…</p>
          )
        ) : null}
      </section>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => openTab(tab.id)}
            className={cn(
              'shrink-0 rounded-lg px-3 py-2 text-sm font-medium',
              report === tab.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-9 pl-9"
              placeholder="Search name, roll number, staff ID, book title, accession or transaction ID"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="mr-1 h-4 w-4" /> Filters
            {activeFilterCount ? ` (${activeFilterCount})` : ''}
          </Button>
          {activeFilterCount || search ? (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="mr-1 h-4 w-4" /> Clear
            </Button>
          ) : null}
        </div>

        {showFilters ? (
          <div className="grid gap-3 border-b border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-slate-500">
              Department
              <select
                className={cn(selectClass, 'mt-0.5')}
                value={select.departmentId ?? ''}
                onChange={(e) => {
                  setSelect((c) => ({ ...c, departmentId: e.target.value || undefined }));
                  setPage(1);
                }}
              >
                <option value="">All departments</option>
                {(options?.departments ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Member Type
              <select
                className={cn(selectClass, 'mt-0.5')}
                value={select.memberType ?? ''}
                onChange={(e) => {
                  setSelect((c) => ({ ...c, memberType: e.target.value || undefined }));
                  setPage(1);
                }}
              >
                <option value="">All members</option>
                {(options?.memberTypes ?? []).map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Semester
              <select
                className={cn(selectClass, 'mt-0.5')}
                value={select.semester ?? ''}
                onChange={(e) => {
                  setSelect((c) => ({
                    ...c,
                    semester: e.target.value ? Number(e.target.value) : undefined,
                  }));
                  setPage(1);
                }}
              >
                <option value="">All semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    Semester {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Processed By
              <select
                className={cn(selectClass, 'mt-0.5')}
                value={select.processedById ?? ''}
                onChange={(e) => {
                  setSelect((c) => ({ ...c, processedById: e.target.value || undefined }));
                  setPage(1);
                }}
              >
                <option value="">Anyone</option>
                {(options?.processors ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Borrower Name / Roll No. / Staff ID
              <Input
                className="mt-0.5 h-9"
                value={text.borrower}
                onChange={(e) => {
                  setText((c) => ({ ...c, borrower: e.target.value }));
                  setPage(1);
                }}
              />
            </label>
            <label className="text-xs text-slate-500">
              Book Title
              <Input
                className="mt-0.5 h-9"
                value={text.bookTitle}
                onChange={(e) => {
                  setText((c) => ({ ...c, bookTitle: e.target.value }));
                  setPage(1);
                }}
              />
            </label>
            <label className="text-xs text-slate-500">
              Accession Number
              <Input
                className="mt-0.5 h-9"
                value={text.accession}
                onChange={(e) => {
                  setText((c) => ({ ...c, accession: e.target.value }));
                  setPage(1);
                }}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-500">
                Transaction Type
                <select
                  className={cn(selectClass, 'mt-0.5')}
                  value={select.type ?? ''}
                  onChange={(e) => {
                    setSelect((c) => ({
                      ...c,
                      type: (e.target.value || undefined) as
                        | 'ISSUE'
                        | 'RENEW'
                        | 'RETURN'
                        | undefined,
                    }));
                    setPage(1);
                  }}
                >
                  <option value="">Any</option>
                  <option value="ISSUE">Issue</option>
                  <option value="RENEW">Renewal</option>
                  <option value="RETURN">Return</option>
                </select>
              </label>
              <label className="text-xs text-slate-500">
                Status
                <select
                  className={cn(selectClass, 'mt-0.5')}
                  value={select.status ?? ''}
                  onChange={(e) => {
                    setSelect((c) => ({ ...c, status: e.target.value || undefined }));
                    setPage(1);
                  }}
                >
                  <option value="">Any</option>
                  {STATUS_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : null}

        {report === 'borrower' ? (
          <div className="border-b border-slate-100 p-3">
            {member ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">
                <span>
                  Borrowing history of <strong>{member.label}</strong>. Choose “All Time” above for
                  the complete history.
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMember(null);
                    setMemberQuery('');
                  }}
                >
                  Change borrower
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder="Find a student or staff member by name, roll number or staff ID"
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                />
                {(memberHits.data?.items ?? []).length ? (
                  <ul className="divide-y rounded-lg border text-sm">
                    {memberHits.data!.items.map((m) => {
                      const id = m.studentId ?? m.staffProfileId;
                      if (!id) return null;
                      return (
                        <li key={`${m.memberType}-${m.memberId}`}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left hover:bg-slate-50"
                            onClick={() => {
                              setMember({
                                id,
                                label: `${m.fullName} (${m.rollNumber || m.registrationNumber || m.memberType})`,
                              });
                              setPage(1);
                            }}
                          >
                            <span className="font-medium">{m.fullName}</span>
                            <span className="ml-2 text-xs text-slate-500">
                              {m.rollNumber || m.registrationNumber || ''} ·{' '}
                              {m.department || m.memberType}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : debouncedMember.trim().length > 1 && !memberHits.isLoading ? (
                  <p className="text-xs text-slate-500">No member matches.</p>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {report === 'borrower' && !member ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            Select a student or staff member to see their borrowing history.
          </p>
        ) : rowsQ.isError ? (
          <p className="px-4 py-10 text-center text-sm text-rose-600">
            {apiErrorMessage(rowsQ.error, 'Could not load the report')}
          </p>
        ) : !rows ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Loading…</p>
        ) : (
          <CirculationReportTable
            report={report}
            data={rows}
            sortBy={sort.sortBy}
            sortDir={sort.sortDir}
            onSort={(key) => {
              setSort((c) => ({
                sortBy: key,
                sortDir: c.sortBy === key && c.sortDir === 'desc' ? 'asc' : 'desc',
              }));
              setPage(1);
            }}
            onDepartment={(row) => {
              setSelect((c) => ({ ...c, departmentId: row.departmentId ?? undefined }));
              openTab('all');
            }}
            onLibrarian={(row) => {
              setSelect((c) => ({ ...c, processedById: row.processedById ?? undefined }));
              openTab('all');
            }}
          />
        )}

        {paged ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>
              {paged.total === 0
                ? 'No records'
                : `Showing ${(paged.page - 1) * paged.limit + 1}–${Math.min(paged.page * paged.limit, paged.total)} of ${paged.total.toLocaleString()} records`}
              {rowsQ.isFetching ? ' · updating…' : ''}
            </span>
            <div className="flex items-center gap-2">
              <select
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                value={limit}
                aria-label="Rows per page"
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[25, 50, 100, 200].map((n) => (
                  <option key={n} value={n}>
                    {n} per page
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                disabled={paged.page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="tabular-nums">
                {paged.page} / {paged.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={paged.page >= paged.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
