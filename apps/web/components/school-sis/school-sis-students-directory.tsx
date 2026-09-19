'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  assignSchoolSisRollNumbers,
  fetchSchoolSisMasters,
  fetchSchoolSisStudents,
  type SchoolSisStudent,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { profileCompletion, studentInitials } from '@/lib/school-sis/student-profile';
import { SlsCta, SlsKpiCard } from '@/components/school-sis/school-sis-saas';
import './school-sis-students.css';

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

function displayName(name?: string | null) {
  const value = (name ?? '').trim();
  if (!value) return '—';
  if (value === value.toUpperCase() && /[A-Z]/.test(value)) {
    return value.toLowerCase().replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
  }
  return value;
}

const COL_LABELS: Record<ColKey, string> = {
  photo: 'Photo',
  admission: 'Admission No.',
  roll: 'Roll No.',
  klass: 'Class & Section',
  dob: 'Date of Birth',
  guardian: 'Parent / Guardian',
  phone: 'Phone',
  profile: 'Profile',
  status: 'Status',
};

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
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.session?.user);
  const canManage = canManageSchoolSis(user?.permissions);
  const [q, setQ] = useState(params.get('q') ?? '');
  const [debouncedQ, setDebouncedQ] = useState(q);
  const [gradeId, setGradeId] = useState(params.get('gradeId') ?? '');
  const [sectionId, setSectionId] = useState(params.get('sectionId') ?? '');
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);
  const [rollBusy, setRollBusy] = useState(false);
  const [rollMessage, setRollMessage] = useState<string | null>(null);

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
      if (statusFilter && s.status !== statusFilter) return false;
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
  }, [allRows, debouncedQ, gradeId, sectionId, incompleteOnly, statusFilter]);

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

  const statusOptions = useMemo(() => {
    return Array.from(new Set(allRows.map((s) => s.status).filter(Boolean))).sort();
  }, [allRows]);

  const clearFilters = () => {
    setQ('');
    setDebouncedQ('');
    setGradeId('');
    setSectionId('');
    setStatusFilter('');
    setIncompleteOnly(false);
    setAdvanced(false);
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
    <div className="sls-page sls-register space-y-5">
      <div className="sls-page-head">
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
        <div className="sls-page-actions">
          <button
            type="button"
            disabled
            title="Office Excel import will be added here. The register was loaded from the school files."
            className="sls-register-ghost"
          >
            <Upload className="h-4 w-4" />
            Import Students
          </button>
          <button
            type="button"
            onClick={() =>
              exportCsv(selected.length ? allRows.filter((s) => selected.includes(s.id)) : filtered)
            }
            className="sls-register-ghost"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          {canManage ? (
            <SlsCta href="/admin/school-sis/students/new">
              <UserPlus className="h-4 w-4" />
              Add Student
            </SlsCta>
          ) : null}
        </div>
      </div>

      <div className="sls-stat-grid">
        <SlsKpiCard
          tone="sky"
          icon={Users}
          label="Total Students"
          value={stats.total}
          hint="On the school register"
          loading={students.isLoading}
        />
        <SlsKpiCard
          tone="emerald"
          icon={Users}
          label="Active Students"
          value={stats.active}
          hint={stats.total ? `${Math.round((stats.active / stats.total) * 100)}% of total` : '—'}
          trend={stats.total ? `${Math.round((stats.active / stats.total) * 100)}%` : '0%'}
          trendLabel="of register"
          loading={students.isLoading}
        />
        <SlsKpiCard
          tone="amber"
          icon={GraduationCap}
          label="Enrolled this year"
          value={stats.enrolled}
          hint={masters.data?.academicYear.name ?? 'Current session'}
          loading={students.isLoading}
        />
        <SlsKpiCard
          tone="cyan"
          icon={Users}
          label="Boys"
          value={stats.boys}
          hint={
            stats.gendered
              ? `${Math.round((stats.boys / stats.gendered) * 100)}% of recorded gender`
              : 'Gender not recorded yet'
          }
          trend={stats.gendered ? `${Math.round((stats.boys / stats.gendered) * 100)}%` : '0%'}
          trendLabel="recorded"
          loading={students.isLoading}
        />
        <SlsKpiCard
          tone="rose"
          icon={Users}
          label="Girls"
          value={stats.girls}
          hint={
            stats.gendered
              ? `${Math.round((stats.girls / stats.gendered) * 100)}% of recorded gender`
              : 'Gender not recorded yet'
          }
          trend={stats.gendered ? `${Math.round((stats.girls / stats.gendered) * 100)}%` : '0%'}
          trendLabel="recorded"
          loading={students.isLoading}
        />
        <SlsKpiCard
          tone="violet"
          icon={Filter}
          label="Incomplete Profiles"
          value={stats.incomplete}
          hint="Need attention"
          trend={stats.total ? `${Math.round((stats.incomplete / stats.total) * 100)}%` : '0%'}
          trendLabel="of register"
          loading={students.isLoading}
          onClick={() => {
            setIncompleteOnly(true);
            setPage(1);
          }}
        />
      </div>

      <div className="sls-chip-row">
        <button
          type="button"
          className={cn('sls-register-chip', !gradeId && 'is-on')}
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
            className={cn('sls-register-chip', gradeId === grade.id && 'is-on')}
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

      <div className="sls-filter-bar sls-toolbar">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, admission no., roll no., phone, or parent…"
            className="sls-register-search"
          />
        </div>
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className={cn('sls-register-ghost', advanced && 'is-on')}
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>
        <select
          className="min-w-0 flex-none px-3 lg:w-auto"
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
        <select
          className="min-w-0 flex-none px-3 lg:w-auto"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All status</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status.charAt(0) + status.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <button type="button" onClick={clearFilters} className="sls-register-ghost">
          <X className="h-4 w-4" />
          Clear
        </button>
      </div>

      {advanced ? (
        <label className="sls-register-advanced">
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

      {rollMessage ? <p className="text-sm text-slate-600">{rollMessage}</p> : null}

      {students.isError ? (
        <p className="text-sm text-red-600">{apiErrorMessage(students.error)}</p>
      ) : null}

      <div className="sls-register-panel">
        <div className="sls-chip-row sls-register-bulk">
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
            'Change Status',
            'Print ID Cards',
          ].map((label) => (
            <button
              key={label}
              type="button"
              disabled
              title="Coming soon"
              className="sls-register-ghost"
            >
              {label}
            </button>
          ))}
          {canManage ? (
            <button
              type="button"
              disabled={rollBusy}
              title={
                selected.length
                  ? 'Assign unique SLS year roll numbers to selected students who do not have one yet'
                  : 'Assign unique SLS year roll numbers to students missing them'
              }
              onClick={() => {
                setRollBusy(true);
                setRollMessage(null);
                void assignSchoolSisRollNumbers(selected.length ? selected : undefined)
                  .then(async (result) => {
                    setRollMessage(
                      result.assigned
                        ? `Assigned ${result.assigned} roll number${result.assigned === 1 ? '' : 's'} for ${result.yearCode}.`
                        : 'Every selected student already has a unique year roll number.',
                    );
                    await queryClient.invalidateQueries({
                      queryKey: ['school-sis-students-register'],
                    });
                  })
                  .catch((err: unknown) => {
                    setRollMessage(apiErrorMessage(err));
                  })
                  .finally(() => setRollBusy(false));
              }}
              className="sls-register-ghost disabled:text-slate-400"
            >
              {rollBusy ? 'Assigning…' : 'Assign Roll No.'}
            </button>
          ) : (
            <button type="button" disabled className="sls-register-ghost">
              Assign Roll No.
            </button>
          )}
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setColumnsOpen((v) => !v)}
              className="sls-register-ghost"
            >
              <Columns3 className="h-3.5 w-3.5" />
              Columns
            </button>
            {columnsOpen ? (
              <div className="sls-register-menu absolute right-0 z-20 mt-1 w-44 p-2">
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
                    {COL_LABELS[key]}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="sls-register-table-wrap">
          <table className="sls-register-table">
            <thead>
              <tr>
                <th>
                  <span className="sr-only">Select</span>
                </th>
                <th>#</th>
                <th>Student</th>
                {cols.admission ? <th>Admission No.</th> : null}
                {cols.roll ? <th>Roll No.</th> : null}
                {cols.klass ? <th>Class & Section</th> : null}
                {cols.dob ? <th>Date of Birth</th> : null}
                {cols.guardian ? <th>Parent / Guardian</th> : null}
                {cols.phone ? <th>Phone</th> : null}
                {cols.profile ? <th>Profile</th> : null}
                {cols.status ? <th>Status</th> : null}
                <th>Actions</th>
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
                    <tr key={s.id}>
                      <td>
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
                      <td className="text-xs text-slate-400">{idx}</td>
                      <td>
                        <div className="sls-register-student">
                          {cols.photo ? (
                            s.photoUrl ? (
                              <span className="sls-register-avatar">
                                <img src={s.photoUrl} alt="" />
                              </span>
                            ) : (
                              <span className="sls-register-avatar">{initials(s.fullName)}</span>
                            )
                          ) : null}
                          <Link
                            href={`/admin/school-sis/students/${s.id}`}
                            className="sls-register-name"
                          >
                            {displayName(s.fullName)}
                          </Link>
                        </div>
                      </td>
                      {cols.admission ? (
                        <td className="sls-register-mono">{s.admissionNumber}</td>
                      ) : null}
                      {cols.roll ? (
                        <td className="sls-register-mono">{enr?.rollNumber ?? '—'}</td>
                      ) : null}
                      {cols.klass ? (
                        <td>
                          {enr ? (
                            <span className="sls-register-class">
                              {enr.section.grade.name} {enr.section.name}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      ) : null}
                      {cols.dob ? (
                        <td className="whitespace-nowrap text-slate-600">
                          {formatDob(s.dateOfBirth)}
                        </td>
                      ) : null}
                      {cols.guardian ? (
                        <td>
                          <p className="font-medium text-slate-800">
                            {displayName(guardian?.fullName)}
                          </p>
                          <p className="text-[11px] capitalize text-slate-400">
                            {guardian ? relation.toLowerCase() : ''}
                          </p>
                        </td>
                      ) : null}
                      {cols.phone ? (
                        <td className="whitespace-nowrap text-slate-600">
                          {s.phone || guardian?.phone || '—'}
                        </td>
                      ) : null}
                      {cols.profile ? (
                        <td>
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
                        <td>
                          <span
                            className={cn(
                              'sls-register-status',
                              incomplete
                                ? 'is-warn'
                                : s.status === 'ACTIVE'
                                  ? 'is-active'
                                  : 'is-muted',
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
                      <td className="relative">
                        <button
                          type="button"
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          onClick={() => setMenuId((id) => (id === s.id ? null : s.id))}
                          aria-label="Row actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuId === s.id ? (
                          <div className="sls-register-menu absolute right-3 z-20 mt-1 w-36 overflow-hidden py-1">
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

        <div className="sls-register-foot">
          <p>
            {filtered.length
              ? `Showing ${start} to ${end} of ${filtered.length} students`
              : 'No records'}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              Rows per page
              <select
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
            <div className="sls-register-pager">
              <button
                type="button"
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
                      className={n === safePage ? 'is-on' : undefined}
                    >
                      {n}
                    </button>
                  </span>
                );
              })}
              <button
                type="button"
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
