'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Filter,
  GraduationCap,
  MoreHorizontal,
  Search,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  fetchSchoolSisMasters,
  fetchSchoolSisStudents,
  type SchoolSisStudent,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { profileCompletion, studentInitials } from '@/lib/school-sis/student-profile';

const PAGE_SIZES = [10, 25, 50];

type ColKey =
  | 'photo'
  | 'admission'
  | 'roll'
  | 'klass'
  | 'dob'
  | 'guardian'
  | 'phone'
  | 'profile'
  | 'status';

const DEFAULT_COLS: Record<ColKey, boolean> = {
  photo: true,
  admission: true,
  roll: true,
  klass: true,
  dob: true,
  guardian: true,
  phone: true,
  profile: true,
  status: true,
};

function enrollment(s: SchoolSisStudent) {
  return s.enrollments[0];
}

function initials(name: string) {
  return studentInitials(name);
}

function formatDob(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isMale(g?: string | null) {
  const v = (g ?? '').toUpperCase();
  return v === 'MALE' || v === 'M' || v === 'BOY';
}

function isFemale(g?: string | null) {
  const v = (g ?? '').toUpperCase();
  return v === 'FEMALE' || v === 'F' || v === 'GIRL';
}

function profilePct(s: SchoolSisStudent) {
  return profileCompletion(s).percent;
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function SchoolSisStudentsDirectory() {
  const params = useSearchParams();
  const enabled = useAuthQueryEnabled();
  const user = useAuthStore((s) => s.session?.user);
  const canManage = canManageSchoolSis(user?.permissions);
  const [q, setQ] = useState(params.get('q') ?? '');
  const [debouncedQ, setDebouncedQ] = useState(q);
  const [gradeId, setGradeId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const masters = useQuery({
    queryKey: ['school-sis-masters'],
    queryFn: fetchSchoolSisMasters,
    enabled,
  });
  const students = useQuery({
    queryKey: ['school-sis-students-register'],
    queryFn: () => fetchSchoolSisStudents(),
    enabled,
  });

  const allRows = students.data ?? [];

  const filtered = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    return allRows.filter((s) => {
      const enr = enrollment(s);
      if (gradeId && enr?.section.grade.id !== gradeId) return false;
      if (sectionId && enr?.section.id !== sectionId) return false;
      if (incompleteOnly && profilePct(s) >= 70) return false;
      if (!needle) return true;
      const guardian = s.guardians[0]?.guardian;
      const hay = [
        s.fullName,
        s.admissionNumber,
        enr?.rollNumber,
        s.phone,
        guardian?.fullName,
        guardian?.phone,
        enr?.section.grade.name,
        enr?.section.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [allRows, debouncedQ, gradeId, sectionId, incompleteOnly]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const stats = useMemo(() => {
    const total = allRows.length;
    const active = allRows.filter((s) => s.status === 'ACTIVE').length;
    const enrolled = allRows.filter((s) => enrollment(s)).length;
    const boys = allRows.filter((s) => isMale(s.gender)).length;
    const girls = allRows.filter((s) => isFemale(s.gender)).length;
    const incomplete = allRows.filter((s) => profilePct(s) < 70).length;
    const gendered = boys + girls;
    return { total, active, enrolled, boys, girls, incomplete, gendered };
  }, [allRows]);

  const classChips = useMemo(() => {
    const grades = masters.data?.grades ?? [];
    return grades.map((grade) => ({
      ...grade,
      count: allRows.filter((s) => enrollment(s)?.section.grade.id === grade.id).length,
    }));
  }, [masters.data?.grades, allRows]);

  const sections = useMemo(() => {
    const all = masters.data?.sections ?? [];
    return gradeId ? all.filter((s) => s.grade.id === gradeId) : all;
  }, [masters.data?.sections, gradeId]);

  const clearFilters = () => {
    setQ('');
    setDebouncedQ('');
    setGradeId('');
    setSectionId('');
    setIncompleteOnly(false);
    setPage(1);
  };

  const toggleAllPage = (on: boolean) => {
    const ids = pageRows.map((s) => s.id);
    setSelected((prev) =>
      on ? Array.from(new Set([...prev, ...ids])) : prev.filter((id) => !ids.includes(id)),
    );
  };

  const exportCsv = (rows: SchoolSisStudent[]) => {
    const header = [
      'Admission No',
      'Full Name',
      'Class',
      'Section',
      'Roll',
      'Date of Birth',
      'Father / Guardian',
      'Phone',
      'House',
      'Status',
    ];
    const lines = rows.map((s) => {
      const enr = enrollment(s);
      const g = s.guardians[0]?.guardian;
      return [
        s.admissionNumber,
        s.fullName,
        enr?.section.grade.name ?? '',
        enr?.section.name ?? '',
        enr?.rollNumber ?? '',
        formatDob(s.dateOfBirth),
        g?.fullName ?? '',
        s.phone || g?.phone || '',
        s.currentAddress?.house ?? '',
        s.status,
      ]
        .map((v) => csvEscape(String(v)))
        .join(',');
    });
    const blob = new Blob([[header.join(','), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'st-lukes-students.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const pageSelected = pageRows.length > 0 && pageRows.every((s) => selected.includes(s.id));
  const start = filtered.length ? (safePage - 1) * pageSize + 1 : 0;
  const end = Math.min(safePage * pageSize, filtered.length);
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((n) => {
    if (totalPages <= 7) return true;
    return n === 1 || n === totalPages || Math.abs(n - safePage) <= 1;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-medium text-slate-400">Dashboard / Students</p>
            <h1 className="text-2xl font-semibold tracking-tight text-[#1a365d]">Students</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Manage student profiles, enrollment and academic records for{' '}
              {masters.data?.academicYear.name ?? 'the current academic year'}.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            title="Office Excel import will be added here. The register was loaded from the school files."
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-400"
          >
            <Upload className="h-4 w-4" />
            Import Students
          </button>
          <button
            type="button"
            onClick={() =>
              exportCsv(selected.length ? allRows.filter((s) => selected.includes(s.id)) : filtered)
            }
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-sky-200"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          {canManage ? (
            <Link
              href="/admin/school-sis/students/new"
              className="inline-flex items-center gap-2 rounded-xl bg-[#2563eb] px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1d4ed8]"
            >
              <UserPlus className="h-4 w-4" />
              Add Student
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          {
            label: 'Total Students',
            value: stats.total,
            hint: 'On the school register',
            icon: Users,
            wrap: 'bg-sky-50 text-sky-700',
          },
          {
            label: 'Active Students',
            value: stats.active,
            hint: stats.total ? `${Math.round((stats.active / stats.total) * 100)}% of total` : '—',
            icon: Users,
            wrap: 'bg-emerald-50 text-emerald-700',
          },
          {
            label: 'Enrolled this year',
            value: stats.enrolled,
            hint: masters.data?.academicYear.name ?? 'Current session',
            icon: GraduationCap,
            wrap: 'bg-amber-50 text-amber-700',
          },
          {
            label: 'Boys',
            value: stats.boys,
            hint: stats.gendered
              ? `${Math.round((stats.boys / stats.gendered) * 100)}% of recorded gender`
              : 'Gender not recorded yet',
            icon: Users,
            wrap: 'bg-blue-50 text-blue-700',
          },
          {
            label: 'Girls',
            value: stats.girls,
            hint: stats.gendered
              ? `${Math.round((stats.girls / stats.gendered) * 100)}% of recorded gender`
              : 'Gender not recorded yet',
            icon: Users,
            wrap: 'bg-pink-50 text-pink-700',
          },
          {
            label: 'Incomplete Profiles',
            value: stats.incomplete,
            hint: 'Need attention',
            icon: Filter,
            wrap: 'bg-violet-50 text-violet-700',
            alert: stats.incomplete > 0,
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              className="rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
              onClick={() => {
                if (card.label === 'Incomplete Profiles') {
                  setIncompleteOnly(true);
                  setPage(1);
                }
              }}
            >
              <span
                className={cn(
                  'inline-flex h-9 w-9 items-center justify-center rounded-xl',
                  card.wrap,
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {card.label}
              </p>
              <p className="mt-1 text-2xl font-semibold text-[#1a365d]">
                {students.isLoading ? '—' : card.value}
              </p>
              <p
                className={cn(
                  'mt-1 text-xs',
                  card.alert ? 'font-medium text-rose-600' : 'text-slate-400',
                )}
              >
                {card.hint}
              </p>
            </button>
          );
        })}
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          className={cn(
            'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold',
            !gradeId
              ? 'bg-[#1a365d] text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-sky-200',
          )}
          onClick={() => {
            setGradeId('');
            setSectionId('');
            setPage(1);
          }}
        >
          All Classes
          <span className={cn('ml-1.5', !gradeId ? 'text-sky-100' : 'text-slate-400')}>
            {stats.total}
          </span>
        </button>
        {classChips.map((grade) => (
          <button
            key={grade.id}
            type="button"
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold',
              gradeId === grade.id
                ? 'bg-[#1a365d] text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-sky-200',
            )}
            onClick={() => {
              setGradeId(grade.id);
              setSectionId('');
              setPage(1);
            }}
          >
            {grade.name}
            <span
              className={cn('ml-1.5', gradeId === grade.id ? 'text-sky-100' : 'text-slate-400')}
            >
              {grade.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, admission no., roll no., phone, or parent…"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-sm outline-none focus:border-sky-300 focus:bg-white"
          />
        </div>
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className={cn(
            'inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium',
            advanced
              ? 'border-sky-200 bg-sky-50 text-[#1a365d]'
              : 'border-slate-200 bg-white text-slate-600',
          )}
        >
          <Filter className="h-4 w-4" />
          Advanced Filters
        </button>
        <select
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
          value={sectionId}
          onChange={(e) => {
            setSectionId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All sections</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.grade.name} {section.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-500 hover:bg-slate-50"
        >
          <X className="h-4 w-4" />
          Clear
        </button>
      </div>

      {advanced ? (
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={incompleteOnly}
            onChange={(e) => {
              setIncompleteOnly(e.target.checked);
              setPage(1);
            }}
          />
          Incomplete profiles only (below 70%)
        </label>
      ) : null}

      {students.isError ? (
        <p className="text-sm text-red-600">{apiErrorMessage(students.error)}</p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5">
          <label className="flex items-center gap-2 px-1 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={pageSelected}
              onChange={(e) => toggleAllPage(e.target.checked)}
            />
            {selected.length ? `${selected.length} selected` : 'Select'}
          </label>
          {[
            'Bulk Actions',
            'Assign Class',
            'Assign Section',
            'Assign Roll No.',
            'Change Status',
            'Print ID Cards',
          ].map((label) => (
            <button
              key={label}
              type="button"
              disabled
              title="Coming soon"
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-400"
            >
              {label}
            </button>
          ))}
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setColumnsOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600"
            >
              <Columns3 className="h-3.5 w-3.5" />
              Columns
            </button>
            {columnsOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                {(Object.keys(cols) as ColKey[]).map((key) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={cols[key]}
                      onChange={(e) => setCols((c) => ({ ...c, [key]: e.target.checked }))}
                    />
                    {key}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f4f8fc] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-2 py-3">#</th>
                {cols.photo ? <th className="px-2 py-3">Photo</th> : null}
                <th className="px-3 py-3">Student Name</th>
                {cols.admission ? <th className="px-3 py-3">Admission No.</th> : null}
                {cols.roll ? <th className="px-3 py-3">Roll No.</th> : null}
                {cols.klass ? <th className="px-3 py-3">Class & Section</th> : null}
                {cols.dob ? <th className="px-3 py-3">Date of Birth</th> : null}
                {cols.guardian ? <th className="px-3 py-3">Parent / Guardian</th> : null}
                {cols.phone ? <th className="px-3 py-3">Phone</th> : null}
                {cols.profile ? <th className="px-3 py-3">Profile</th> : null}
                {cols.status ? <th className="px-3 py-3">Status</th> : null}
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.isLoading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-500">
                    Loading student register…
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-500">
                    No students match this filter.
                  </td>
                </tr>
              ) : (
                pageRows.map((s, i) => {
                  const enr = enrollment(s);
                  const guardian = s.guardians[0]?.guardian;
                  const relation = s.guardians[0]?.relationship || guardian?.relation || 'Guardian';
                  const pct = profilePct(s);
                  const incomplete = pct < 70;
                  const idx = (safePage - 1) * pageSize + i + 1;
                  return (
                    <tr
                      key={s.id}
                      className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-sky-50/50"
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selected.includes(s.id)}
                          onChange={(e) =>
                            setSelected((prev) =>
                              e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                            )
                          }
                        />
                      </td>
                      <td className="px-2 py-2.5 text-xs text-slate-400">{idx}</td>
                      {cols.photo ? (
                        <td className="px-2 py-2.5">
                          {s.photoUrl ? (
                            <img
                              src={s.photoUrl}
                              alt=""
                              className="h-9 w-9 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-[11px] font-semibold text-sky-800">
                              {initials(s.fullName)}
                            </span>
                          )}
                        </td>
                      ) : null}
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/admin/school-sis/students/${s.id}`}
                          className="font-semibold uppercase tracking-wide text-[#1a365d] hover:underline"
                        >
                          {s.fullName}
                        </Link>
                      </td>
                      {cols.admission ? (
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-600">
                          {s.admissionNumber}
                        </td>
                      ) : null}
                      {cols.roll ? (
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-600">
                          {enr?.rollNumber ?? '—'}
                        </td>
                      ) : null}
                      {cols.klass ? (
                        <td className="px-3 py-2.5">
                          {enr ? (
                            <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">
                              {enr.section.grade.name} {enr.section.name}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      ) : null}
                      {cols.dob ? (
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                          {formatDob(s.dateOfBirth)}
                        </td>
                      ) : null}
                      {cols.guardian ? (
                        <td className="px-3 py-2.5">
                          <p className="text-slate-800">{guardian?.fullName ?? '—'}</p>
                          <p className="text-[11px] capitalize text-slate-400">
                            {guardian ? relation.toLowerCase() : ''}
                          </p>
                        </td>
                      ) : null}
                      {cols.phone ? (
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                          {s.phone || guardian?.phone || '—'}
                        </td>
                      ) : null}
                      {cols.profile ? (
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  pct >= 85
                                    ? 'bg-emerald-500'
                                    : pct >= 60
                                      ? 'bg-amber-400'
                                      : 'bg-rose-500',
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-slate-500">{pct}%</span>
                          </div>
                        </td>
                      ) : null}
                      {cols.status ? (
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                              incomplete
                                ? 'bg-rose-50 text-rose-700'
                                : s.status === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {incomplete
                              ? 'Incomplete'
                              : s.status === 'ACTIVE'
                                ? 'Active'
                                : s.status}
                          </span>
                        </td>
                      ) : null}
                      <td className="relative px-3 py-2.5">
                        <button
                          type="button"
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          onClick={() => setMenuId((id) => (id === s.id ? null : s.id))}
                          aria-label="Row actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuId === s.id ? (
                          <div className="absolute right-3 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                            <Link
                              href={`/admin/school-sis/students/${s.id}`}
                              className="block px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                              onClick={() => setMenuId(null)}
                            >
                              View Student
                            </Link>
                            {canManage ? (
                              <Link
                                href={`/admin/school-sis/students/${s.id}/edit`}
                                className="block px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                                onClick={() => setMenuId(null)}
                              >
                                Edit
                              </Link>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <p>
            {filtered.length
              ? `Showing ${start} to ${end} of ${filtered.length} students`
              : 'No records'}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              Rows per page
              <select
                className="h-8 rounded-lg border border-slate-200 px-2"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pages.map((n, i) => {
                const prev = pages[i - 1];
                return (
                  <span key={n} className="flex items-center">
                    {prev && n - prev > 1 ? <span className="px-1">…</span> : null}
                    <button
                      type="button"
                      onClick={() => setPage(n)}
                      className={cn(
                        'h-8 min-w-8 rounded-lg px-2',
                        n === safePage
                          ? 'bg-[#2563eb] text-white'
                          : 'border border-slate-200 hover:bg-slate-50',
                      )}
                    >
                      {n}
                    </button>
                  </span>
                );
              })}
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
