'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  Filter,
  GraduationCap,
  History,
  Pause,
  Search,
  Settings2,
  Upload,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  applySchoolPromotion,
  fetchSchoolPromotion,
  type SchoolSisPromotionSection,
  type SchoolSisPromotionStudent,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { StatusBadge } from './academic-ui';

type Lane = 'all' | 'ready' | 'held' | 'withdrawn';
type ActionKind = 'PROMOTE' | 'HOLD' | 'WITHDRAW';

function sectionLabel(row: SchoolSisPromotionSection, currentYearId?: string) {
  const sameYear = currentYearId && row.academicYearId === currentYearId;
  const prefix = sameYear ? 'Same year' : row.academicYear.name;
  return `${prefix} · ${row.grade.name} ${row.name}`;
}

function laneOf(row: SchoolSisPromotionStudent): Exclude<Lane, 'all'> {
  if (
    row.status === 'WITHDRAWN' ||
    row.studentStatus === 'WITHDRAWN' ||
    row.lastEventType === 'WITHDRAWN'
  ) {
    return 'withdrawn';
  }
  if (row.lastEventType === 'HELD_BACK') return 'held';
  return 'ready';
}

export function AcademicPromotionPanel() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const [sectionId, setSectionId] = useState('');
  const [toSectionId, setToSectionId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [lane, setLane] = useState<Lane>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    body: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  }>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['school-promotion', sectionId],
    queryFn: () => fetchSchoolPromotion(sectionId || undefined),
    enabled,
  });

  const year = query.data?.academicYear;
  const sections = query.data?.sections ?? [];
  const currentSections = sections.filter((s) => s.academicYearId === year?.id);
  const students = query.data?.students ?? [];

  useEffect(() => {
    setSelected([]);
    setPage(1);
  }, [sectionId]);

  useEffect(() => {
    if (!students.length) return;
    setDestinations((prev) => {
      const next = { ...prev };
      for (const row of students) {
        if (!next[row.studentId]) {
          next[row.studentId] = row.suggestedToSectionId || toSectionId;
        }
      }
      return next;
    });
  }, [students, toSectionId]);

  useEffect(() => {
    if (!sectionId) return;
    const from = sections.find((s) => s.id === sectionId);
    if (!from) return;
    const suggested = students.find((s) => s.sectionId === sectionId)?.suggestedToSectionId;
    if (suggested) setToSectionId(suggested);
  }, [sectionId, sections, students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((row) => {
      const laneValue = laneOf(row);
      if (lane !== 'all' && laneValue !== lane) return false;
      if (statusFilter === 'active' && row.status !== 'ACTIVE') return false;
      if (statusFilter === 'withdrawn' && row.status !== 'WITHDRAWN') return false;
      if (
        q &&
        !`${row.fullName} ${row.admissionNumber} ${row.rollNumber ?? ''} ${row.className}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [students, search, lane, statusFilter]);

  const counts = useMemo(() => {
    const ready = students.filter((s) => laneOf(s) === 'ready').length;
    const held = students.filter((s) => laneOf(s) === 'held').length;
    const withdrawn = students.filter((s) => laneOf(s) === 'withdrawn').length;
    return { ready, held, withdrawn, total: students.length };
  }, [students]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selectedRows = students.filter((s) => selected.includes(s.studentId));
  const currentClassLabel = currentSections.find((s) => s.id === sectionId);
  const selectedPromote = selectedRows.filter((s) => laneOf(s) !== 'withdrawn').length;

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectVisible = (ids: string[]) => setSelected(ids);

  const run = (action: ActionKind) => {
    if (!selected.length) {
      setError('Select at least one student.');
      return;
    }
    const rows = selectedRows.filter((row) => {
      if (action !== 'WITHDRAW' && laneOf(row) === 'withdrawn') return false;
      return true;
    });
    if (!rows.length) {
      setError('None of the selected students can receive that action.');
      return;
    }
    if (action === 'PROMOTE') {
      const missing = rows.filter((row) => !(destinations[row.studentId] || toSectionId));
      if (missing.length) {
        setError('Choose a promotion class for every selected student.');
        return;
      }
    }
    const label = action === 'PROMOTE' ? 'Promote' : action === 'HOLD' ? 'Hold back' : 'Withdraw';
    const dest = sections.find((s) => s.id === toSectionId);
    const body =
      action === 'PROMOTE'
        ? `${rows.length} student(s) will move to the chosen class. Previous enrolments stay on record.`
        : action === 'HOLD'
          ? `${rows.length} student(s) will be marked held back in the same class.`
          : `${rows.length} student(s) will be withdrawn from the school. This can be reviewed in promotion history.`;
    setConfirm({
      title: `${label} ${rows.length} student${rows.length === 1 ? '' : 's'}?`,
      body:
        dest && action === 'PROMOTE'
          ? `${body} Default destination: ${sectionLabel(dest, year?.id)}.`
          : body,
      confirmLabel: label,
      danger: action === 'WITHDRAW',
      onConfirm: () => void apply(action, rows),
    });
  };

  const apply = async (action: ActionKind, rows: SchoolSisPromotionStudent[]) => {
    setPending(true);
    setError(null);
    try {
      await applySchoolPromotion({
        studentIds: rows.map((r) => r.studentId),
        action,
        toSectionId: toSectionId || undefined,
        items: rows.map((row) => ({
          studentId: row.studentId,
          toSectionId:
            action === 'PROMOTE' ? destinations[row.studentId] || toSectionId : undefined,
          note: remarks[row.studentId]?.trim() || undefined,
        })),
      });
      setSelected([]);
      await qc.invalidateQueries({ queryKey: ['school-promotion'] });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  const exportCsv = () => {
    const header = [
      'Student',
      'Admission',
      'Class',
      'Roll',
      'Status',
      'Promotion action',
      'Remarks',
    ];
    const lines = filtered.map((row) => {
      const dest = sections.find((s) => s.id === (destinations[row.studentId] || toSectionId));
      return [
        row.fullName,
        row.admissionNumber,
        row.className,
        row.rollNumber ?? '',
        row.status,
        dest ? `Promote to ${dest.grade.name} ${dest.name}` : '',
        remarks[row.studentId] ?? '',
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',');
    });
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student-promotion.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const tokens = text
        .split(/[\r\n,;]+/)
        .map((t) => t.replace(/"/g, '').trim())
        .filter(Boolean);
      const matched = students
        .filter((s) => tokens.some((t) => t.toLowerCase() === s.admissionNumber.toLowerCase()))
        .map((s) => s.studentId);
      if (!matched.length) setError('No matching admission numbers were found in that file.');
      else {
        setError(null);
        setSelected(matched);
      }
    };
    reader.readAsText(file);
  };

  const destinationOptions = useMemo(() => {
    const from = sections.find((s) => s.id === sectionId);
    return sections.filter((s) => {
      if (from && s.id === from.id) return false;
      if (!from) return s.id !== sectionId;
      const fromOrder = from.grade.sortOrder ?? 0;
      const toOrder = s.grade.sortOrder ?? 0;
      if (s.academicYearId !== from.academicYearId) return toOrder >= fromOrder;
      return toOrder > fromOrder;
    });
  }, [sections, sectionId]);

  function destinationsFor(row: SchoolSisPromotionStudent) {
    const from = sections.find((s) => s.id === row.sectionId);
    return sections.filter((s) => {
      if (from && s.id === from.id) return false;
      if (!from) return true;
      const fromOrder = from.grade.sortOrder ?? 0;
      const toOrder = s.grade.sortOrder ?? 0;
      if (s.academicYearId !== from.academicYearId) return toOrder >= fromOrder;
      return toOrder > fromOrder;
    });
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Academic Configuration
          </p>
          <div className="mt-1 flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[color:var(--school-erp-primary,#1e3a8a)]">
              <GraduationCap className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Student Promotion
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Promote, hold back or withdraw students without overwriting previous enrolments.
                History is stored as events.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <CalendarDays className="h-4 w-4 text-sky-600" aria-hidden />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Academic Year
              </p>
              <p className="text-sm font-semibold text-slate-800">{year?.name ?? '—'}</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              {year?.status === 'CURRENT' || !year?.status ? 'Active' : year.status}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Settings2 className="h-4 w-4" />
            Promotion Settings
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi
          icon={<Users className="h-4 w-4" />}
          label="Total Students"
          value={counts.total}
          hint={
            currentClassLabel
              ? `in ${currentClassLabel.grade.name} ${currentClassLabel.name}`
              : 'Current year'
          }
          tone="navy"
        />
        <Kpi
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Selected Students"
          value={selected.length}
          hint="Ready for action"
          tone="blue"
        />
        <Kpi
          icon={<ArrowUpRight className="h-4 w-4" />}
          label="Promote"
          value={selectedPromote}
          hint="Move to next class"
          tone="green"
        />
        <Kpi
          icon={<Pause className="h-4 w-4" />}
          label="Hold Back"
          value={selectedRows.filter((s) => laneOf(s) === 'held').length}
          hint="Retain in same class"
          tone="amber"
        />
        <Kpi
          icon={<UserMinus className="h-4 w-4" />}
          label="Withdraw"
          value={selectedRows.filter((s) => laneOf(s) === 'withdrawn').length}
          hint="Remove from school"
          tone="rose"
        />
      </section>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        <label className="min-w-[10rem] text-sm">
          <span className="text-slate-500">Current Class *</span>
          <select
            className={selectClass}
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          >
            <option value="">All classes</option>
            {currentSections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.grade.name} {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[12rem] flex-1 text-sm">
          <span className="text-slate-500">Promote to *</span>
          <select
            className={selectClass}
            value={toSectionId}
            onChange={(e) => {
              setToSectionId(e.target.value);
              setDestinations((prev) => {
                const next = { ...prev };
                for (const id of selected.length ? selected : students.map((s) => s.studentId)) {
                  next[id] = e.target.value;
                }
                return next;
              });
            }}
          >
            <option value="">Choose class / year</option>
            {destinationOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {sectionLabel(s, year?.id)}
              </option>
            ))}
          </select>
        </label>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run('PROMOTE')}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[var(--school-erp-primary,#1e3a8a)] px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              <ArrowUpRight className="h-4 w-4" />
              Promote Selected
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run('HOLD')}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-amber-100 px-3 text-sm font-semibold text-amber-800 disabled:opacity-60"
            >
              <Pause className="h-4 w-4" />
              Hold Back
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run('WITHDRAW')}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-rose-50 px-3 text-sm font-semibold text-rose-700 disabled:opacity-60"
            >
              <UserMinus className="h-4 w-4" />
              Withdraw
            </button>
          </div>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importCsv(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600"
          >
            <Upload className="h-4 w-4" />
            Import (Excel)
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {error ? (
        <p
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-1 overflow-x-auto rounded-full border border-slate-200 bg-slate-100 p-1">
          <LaneTab
            active={lane === 'all'}
            onClick={() => {
              setLane('all');
              setPage(1);
            }}
            label="All Students"
            count={counts.total}
          />
          <LaneTab
            active={lane === 'ready'}
            onClick={() => {
              setLane('ready');
              setPage(1);
            }}
            label="Ready to Promote"
            count={counts.ready}
            tone="green"
          />
          <LaneTab
            active={lane === 'held'}
            onClick={() => {
              setLane('held');
              setPage(1);
            }}
            label="Held Back"
            count={counts.held}
            tone="amber"
          />
          <LaneTab
            active={lane === 'withdrawn'}
            onClick={() => {
              setLane('withdrawn');
              setPage(1);
            }}
            label="Withdrawn"
            count={counts.withdrawn}
            tone="rose"
          />
        </div>
        <label className="relative ml-auto min-w-[14rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[color:var(--school-erp-primary,#1e3a8a)]"
            placeholder="Search by name, admission no. or roll no…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Search students"
          />
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600"
          >
            <Filter className="h-4 w-4" />
            Filter
          </button>
          {filterOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
              <label className="text-sm">
                <span className="text-slate-500">Enrolment status</span>
                <select
                  className={`${selectClass} mt-1`}
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </label>
            </div>
          ) : null}
        </div>
      </div>

      {query.isLoading ? (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : !filtered.length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center">
          <p className="font-semibold text-slate-800">
            {students.length ? 'No students match these filters' : 'No students in this class'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {students.length
              ? 'Try another class, search, or status tab.'
              : 'Enrol students in the current academic year before running promotion.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select visible students"
                      checked={
                        paged.length > 0 && paged.every((r) => selected.includes(r.studentId))
                      }
                      onChange={(e) =>
                        selectVisible(
                          e.target.checked
                            ? [...new Set([...selected, ...paged.map((r) => r.studentId)])]
                            : selected.filter((id) => !paged.some((r) => r.studentId === id)),
                        )
                      }
                    />
                  </th>
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">Student Name</th>
                  <th className="px-3 py-3">Admission No.</th>
                  <th className="px-3 py-3">Class</th>
                  <th className="px-3 py-3">Roll No.</th>
                  <th className="px-3 py-3">Current Status</th>
                  <th className="px-3 py-3">Promotion Action</th>
                  <th className="px-3 py-3">Remarks (optional)</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((row, i) => (
                  <tr
                    key={row.studentId}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                  >
                    <td className="px-3 py-3">
                      {canManage ? (
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.fullName}`}
                          checked={selected.includes(row.studentId)}
                          onChange={() => toggle(row.studentId)}
                        />
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-slate-400">
                      {(safePage - 1) * pageSize + i + 1}
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-800">{row.fullName}</td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-500">
                      {row.admissionNumber}
                    </td>
                    <td className="px-3 py-3">{row.className}</td>
                    <td className="px-3 py-3">{row.rollNumber ?? '—'}</td>
                    <td className="px-3 py-3">
                      <StatusChip lane={laneOf(row)} status={row.status} />
                    </td>
                    <td className="px-3 py-3">
                      <select
                        className="h-9 max-w-[14rem] rounded-lg border border-slate-200 px-2 text-xs"
                        value={destinations[row.studentId] || toSectionId}
                        disabled={!canManage || laneOf(row) === 'withdrawn'}
                        onChange={(e) =>
                          setDestinations((prev) => ({ ...prev, [row.studentId]: e.target.value }))
                        }
                        aria-label={`Promotion destination for ${row.fullName}`}
                      >
                        <option value="">Choose class</option>
                        {destinationsFor(row).map((s) => (
                          <option key={s.id} value={s.id}>
                            Promote to {s.grade.name} {s.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <input
                        className="h-9 w-36 rounded-lg border border-slate-200 px-2 text-xs"
                        placeholder="—"
                        value={remarks[row.studentId] ?? ''}
                        disabled={!canManage}
                        onChange={(e) =>
                          setRemarks((prev) => ({ ...prev, [row.studentId]: e.target.value }))
                        }
                        aria-label={`Remarks for ${row.fullName}`}
                      />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/admin/school-sis/students/${row.studentId}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                        title="View student"
                        aria-label={`View ${row.fullName}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-3 md:hidden">
            {paged.map((row) => (
              <article key={row.studentId} className="rounded-2xl border border-slate-200 p-3">
                <div className="flex items-start gap-2">
                  {canManage ? (
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.includes(row.studentId)}
                      onChange={() => toggle(row.studentId)}
                      aria-label={`Select ${row.fullName}`}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800">{row.fullName}</p>
                    <p className="text-xs text-slate-500">
                      {row.admissionNumber} · {row.className} · Roll {row.rollNumber ?? '—'}
                    </p>
                    <div className="mt-2">
                      <StatusChip lane={laneOf(row)} status={row.status} />
                    </div>
                    <select
                      className="mt-2 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                      value={destinations[row.studentId] || toSectionId}
                      onChange={(e) =>
                        setDestinations((prev) => ({ ...prev, [row.studentId]: e.target.value }))
                      }
                    >
                      <option value="">Choose class</option>
                      {destinationsFor(row).map((s) => (
                        <option key={s.id} value={s.id}>
                          Promote to {s.grade.name} {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Link
                    href={`/admin/school-sis/students/${row.studentId}`}
                    className="rounded-lg p-1 text-slate-500"
                    aria-label={`View ${row.fullName}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-3 text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-2">
              <span>{selected.length} students selected</span>
              {canManage ? (
                <button
                  type="button"
                  className="rounded-lg bg-[var(--school-erp-primary,#1e3a8a)] px-2.5 py-1 font-semibold text-white"
                  onClick={() => selectVisible(filtered.map((r) => r.studentId))}
                >
                  Select All ({filtered.length})
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <span>
                Showing {(safePage - 1) * pageSize + 1} to{' '}
                {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} students
              </span>
              <select
                className="h-8 rounded-lg border border-slate-200 px-2"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                aria-label="Rows per page"
              >
                {[10, 25, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-lg border px-2 py-1 disabled:opacity-40"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ‹
              </button>
              <span className="font-semibold text-slate-700">{safePage}</span>
              <button
                type="button"
                className="rounded-lg border px-2 py-1 disabled:opacity-40"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <p>
          <span className="font-semibold">Important:</span> Promotion will create new enrolments for
          the next academic year. Previous records will be kept safely and will not be overwritten.
          Same-year moves are stored as section changes.
        </p>
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3 text-sm font-medium text-sky-800"
        >
          <History className="h-4 w-4" />
          View Promotion History
        </button>
      </div>

      {historyOpen ? (
        <Modal title="Promotion history" onClose={() => setHistoryOpen(false)}>
          <ul className="max-h-[24rem] space-y-2 overflow-y-auto text-sm">
            {(query.data?.history ?? []).length ? (
              (query.data?.history ?? []).map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 px-3 py-2"
                >
                  <StatusBadge value={row.type} />
                  <span className="font-medium">{row.student.fullName}</span>
                  <span className="text-slate-400">{row.student.admissionNumber}</span>
                  <span className="text-slate-400">
                    {new Date(row.createdAt).toLocaleString('en-IN')}
                  </span>
                  {row.note ? <span className="text-slate-500">{row.note}</span> : null}
                </li>
              ))
            ) : (
              <p className="py-8 text-center text-slate-500">No promotion events yet.</p>
            )}
          </ul>
        </Modal>
      ) : null}

      {settingsOpen ? (
        <Modal title="Promotion settings" onClose={() => setSettingsOpen(false)}>
          <ul className="space-y-3 text-sm text-slate-600">
            <li>
              Next class is suggested from grade order and the same section name (for example UKG A
              → Class I A).
            </li>
            <li>
              Promoting into another academic year creates a new enrolment and marks the current one
              as promoted.
            </li>
            <li>Same-year moves keep the existing enrolment and log a section change.</li>
            <li>Hold back keeps the student in the current class and writes a history event.</li>
            <li>
              Withdraw sets both the enrolment and the student record to withdrawn. History is
              retained.
            </li>
          </ul>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="h-10 rounded-xl bg-[var(--school-erp-primary,#1e3a8a)] px-4 text-sm font-semibold text-white"
              onClick={() => setSettingsOpen(false)}
            >
              Close
            </button>
          </div>
        </Modal>
      ) : null}

      {confirm ? (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <p className="text-sm text-slate-600">{confirm.body}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="h-10 rounded-xl border px-4 text-sm"
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={cn(
                'h-10 rounded-xl px-4 text-sm font-semibold text-white',
                confirm.danger ? 'bg-rose-600' : 'bg-[var(--school-erp-primary,#1e3a8a)]',
              )}
              onClick={() => {
                const fn = confirm.onConfirm;
                setConfirm(null);
                fn();
              }}
            >
              {confirm.confirmLabel}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  tone: 'navy' | 'blue' | 'green' | 'amber' | 'rose';
}) {
  const tones = {
    navy: 'bg-slate-50 text-slate-700',
    blue: 'bg-sky-50 text-sky-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  };
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{hint}</p>
        </div>
        <span
          className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl', tones[tone])}
        >
          {icon}
        </span>
      </div>
    </article>
  );
}

function LaneTab({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone?: 'green' | 'amber' | 'rose';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold',
        active
          ? 'bg-[var(--school-erp-primary,#1e3a8a)] text-white'
          : 'text-slate-600 hover:bg-white',
      )}
    >
      {label}
      <span
        className={cn(
          'rounded-full px-1.5 text-[11px]',
          active
            ? 'bg-white/20 text-white'
            : tone === 'green'
              ? 'bg-emerald-50 text-emerald-700'
              : tone === 'amber'
                ? 'bg-amber-50 text-amber-800'
                : tone === 'rose'
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-white text-slate-500',
        )}
      >
        {count}
      </span>
    </button>
  );
}

function StatusChip({ lane, status }: { lane: Exclude<Lane, 'all'>; status: string }) {
  if (lane === 'held') {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
        Held Back
      </span>
    );
  }
  if (lane === 'withdrawn') {
    return (
      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
        Withdrawn
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
      {status === 'ACTIVE' ? 'Active' : status}
    </span>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const selectClass =
  'mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[color:var(--school-erp-primary,#1e3a8a)]';
