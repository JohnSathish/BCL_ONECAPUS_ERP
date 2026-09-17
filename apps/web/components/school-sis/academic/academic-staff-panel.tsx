'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  activateSchoolAcademicYear,
  assignSchoolSisClassTeacher,
  assignSchoolSisSubjectTeacher,
  fetchSchoolAcademicYears,
  fetchSchoolSisMasters,
  fetchSchoolStaffMap,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { confirmAction, fieldClass } from './academic-ui';

const AVATAR_TONES = [
  'bg-sky-100 text-sky-800',
  'bg-emerald-100 text-emerald-800',
  'bg-violet-100 text-violet-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-indigo-100 text-indigo-800',
];

const CLASS_TONES = [
  'bg-violet-100 text-violet-800',
  'bg-sky-100 text-sky-800',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800',
];

function tone(seed: string, palette: string[]) {
  let n = 0;
  for (let i = 0; i < seed.length; i += 1) n += seed.charCodeAt(i);
  return palette[n % palette.length];
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function pagerItems(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: Array<number | '…'> = [1];
  const start = Math.max(2, Math.min(current - 1, total - 4));
  const end = Math.min(total - 1, Math.max(start + 3, 5));
  if (start > 2) items.push('…');
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < total - 1) items.push('…');
  items.push(total);
  return items;
}

export function AcademicStaffPanel() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const map = useQuery({ queryKey: ['school-staff-map'], queryFn: fetchSchoolStaffMap, enabled });
  const masters = useQuery({
    queryKey: ['school-sis-masters'],
    queryFn: fetchSchoolSisMasters,
    enabled,
  });
  const years = useQuery({
    queryKey: ['school-academic-years'],
    queryFn: fetchSchoolAcademicYears,
    enabled,
  });
  const [error, setError] = useState<string | null>(null);
  const [classForm, setClassForm] = useState({ gradeId: '', sectionId: '', staffId: '' });
  const [subjectForm, setSubjectForm] = useState({
    gradeId: '',
    sectionId: '',
    subjectId: '',
    staffId: '',
  });
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [status, setStatus] = useState('');
  const [more, setMore] = useState(false);
  const [onlyAssigned, setOnlyAssigned] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['school-staff-map'] });
    void qc.invalidateQueries({ queryKey: ['school-sis-masters'] });
  };

  const grades = masters.data?.grades ?? [];
  const sections = masters.data?.sections ?? [];
  const subjects = masters.data?.subjects ?? [];
  const yearName = map.data?.academicYear.name ?? masters.data?.academicYear.name ?? '—';
  const yearId = map.data?.academicYear.id ?? '';

  const classSections = sections.filter(
    (s) => !classForm.gradeId || s.grade.id === classForm.gradeId,
  );
  const subjectSections = sections.filter(
    (s) => !subjectForm.gradeId || s.grade.id === subjectForm.gradeId,
  );

  const departments = useMemo(() => {
    const set = new Set(
      (map.data?.workload ?? [])
        .map((w) => w.department)
        .filter((d): d is string => Boolean(d && d.trim())),
    );
    return [...set].sort();
  }, [map.data]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (map.data?.workload ?? []).filter((w) => {
      if (dept && (w.department ?? '') !== dept) return false;
      if (status && (w.status ?? 'ACTIVE').toLowerCase() !== status) return false;
      if (onlyAssigned && !w.classTeacherSections && !w.subjects) return false;
      if (
        term &&
        !`${w.fullName} ${w.department ?? ''} ${w.email ?? ''} ${w.employeeCode} ${w.classTeacherLabel ?? ''}`
          .toLowerCase()
          .includes(term)
      )
        return false;
      return true;
    });
  }, [map.data, q, dept, status, onlyAssigned]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const viewing =
    rows.find((r) => r.id === viewId) ?? map.data?.workload?.find((r) => r.id === viewId);

  const kpis = useMemo(() => {
    const list = map.data?.workload ?? [];
    const classTeachers = list.filter((w) => w.classTeacherSections > 0).length;
    const subjectTeachers = list.filter((w) => w.subjects > 0).length;
    const periods = list.reduce((n, w) => n + w.periods, 0);
    const assigned = map.data?.coverage?.assignedSections ?? classTeachers;
    const totalSections = map.data?.coverage?.totalSections ?? 0;
    const coverage = totalSections ? Math.round((assigned / totalSections) * 100) : 0;
    return {
      teachers: list.length,
      classTeachers,
      subjectTeachers,
      assigned,
      periods,
      coverage,
    };
  }, [map.data]);

  const assignClass = () => {
    if (!classForm.sectionId || !classForm.staffId) return;
    void assignSchoolSisClassTeacher({
      sectionId: classForm.sectionId,
      staffId: classForm.staffId,
    })
      .then(() => {
        setError(null);
        refresh();
      })
      .catch((err) => setError(apiErrorMessage(err)));
  };

  const assignSubject = () => {
    if (!subjectForm.sectionId || !subjectForm.subjectId || !subjectForm.staffId) return;
    void assignSchoolSisSubjectTeacher({
      sectionId: subjectForm.sectionId,
      subjectId: subjectForm.subjectId,
      staffId: subjectForm.staffId,
    })
      .then(() => {
        setError(null);
        refresh();
      })
      .catch((err) => setError(apiErrorMessage(err)));
  };

  const exportCsv = () => {
    const header = 'Teacher,Employee,Department,Email,Class Teacher,Subjects,Periods,Status';
    const body = rows
      .map((r) =>
        [
          r.fullName,
          r.employeeCode,
          r.department ?? '',
          r.email ?? '',
          r.classTeacherLabel ?? '',
          r.subjects,
          r.periods,
          r.status ?? 'ACTIVE',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'school-class-wise-staff.csv';
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1e3a8a] text-white shadow-sm">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </span>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Class-wise staff</h1>
            <p className="text-sm text-slate-500">
              Assign class teachers and subject teachers to each section. A teacher can be class
              teacher of only one section.
            </p>
          </div>
        </div>
        <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 shadow-sm">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <select
            className="bg-transparent text-sm font-medium outline-none"
            value={yearId}
            onChange={(e) => {
              const id = e.target.value;
              if (!id || id === yearId) return;
              if (
                !confirmAction(
                  `Switch the current academic year to ${e.target.selectedOptions[0]?.text}?`,
                )
              )
                return;
              void activateSchoolAcademicYear(id)
                .then(() => {
                  refresh();
                  void qc.invalidateQueries({ queryKey: ['school-academic-years'] });
                })
                .catch((err) => setError(apiErrorMessage(err)));
            }}
          >
            {(Array.isArray(years.data) ? years.data : []).map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
            {!Array.isArray(years.data) || !years.data.length ? (
              <option value={yearId}>{yearName}</option>
            ) : null}
          </select>
        </label>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          {
            label: 'Total Teachers',
            value: kpis.teachers,
            wrap: 'bg-blue-50/80',
            icon: 'bg-blue-100 text-blue-700',
            path: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
          },
          {
            label: 'Class Teachers',
            value: kpis.classTeachers,
            wrap: 'bg-emerald-50/80',
            icon: 'bg-emerald-100 text-emerald-700',
            path: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
          },
          {
            label: 'Subject Teachers',
            value: kpis.subjectTeachers,
            wrap: 'bg-violet-50/80',
            icon: 'bg-violet-100 text-violet-700',
            path: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
          },
          {
            label: 'Assigned Sections',
            value: kpis.assigned,
            wrap: 'bg-amber-50/80',
            icon: 'bg-amber-100 text-amber-700',
            path: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
          },
          {
            label: 'Workload (Periods/Week)',
            value: kpis.periods,
            wrap: 'bg-rose-50/80',
            icon: 'bg-rose-100 text-rose-700',
            path: 'M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z',
          },
          {
            label: 'Coverage',
            value: `${kpis.coverage}%`,
            wrap: 'bg-emerald-50/80',
            icon: 'bg-emerald-100 text-emerald-700',
            path: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
          },
        ].map((card) => (
          <div
            key={card.label}
            className={cn('rounded-2xl border border-white/70 p-3 shadow-sm', card.wrap)}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium text-slate-500">{card.label}</p>
              <span
                className={cn('flex h-8 w-8 items-center justify-center rounded-xl', card.icon)}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d={card.path} />
                </svg>
              </span>
            </div>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {canManage ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <form
            className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              assignClass();
            }}
          >
            <div className="mb-3 flex items-start gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-800">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M22 10 12 5 2 10l10 5 10-5z" />
                </svg>
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Assign Class Teacher</h2>
                <p className="text-xs text-slate-500">
                  Select a section and assign a class teacher.
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <select
                className={`${fieldClass} rounded-xl`}
                required
                value={classForm.gradeId}
                onChange={(e) =>
                  setClassForm({
                    gradeId: e.target.value,
                    sectionId: '',
                    staffId: classForm.staffId,
                  })
                }
              >
                <option value="">Select class</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <select
                className={`${fieldClass} rounded-xl`}
                required
                value={classForm.sectionId}
                onChange={(e) => setClassForm({ ...classForm, sectionId: e.target.value })}
              >
                <option value="">Select section</option>
                {classSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className={`${fieldClass} rounded-xl`}
                required
                value={classForm.staffId}
                onChange={(e) => setClassForm({ ...classForm, staffId: e.target.value })}
              >
                <option value="">Select teacher</option>
                {(map.data?.staff ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#1e3a8a] px-4 text-sm font-semibold text-white"
              >
                Assign
              </button>
            </div>
          </form>
          <form
            className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              assignSubject();
            }}
          >
            <div className="mb-3 flex items-start gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Assign Subject Teacher</h2>
                <p className="text-xs text-slate-500">
                  Assign a subject teacher for a class and section.
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-5">
              <select
                className={`${fieldClass} rounded-xl`}
                required
                value={subjectForm.gradeId}
                onChange={(e) =>
                  setSubjectForm({
                    ...subjectForm,
                    gradeId: e.target.value,
                    sectionId: '',
                  })
                }
              >
                <option value="">Select class</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <select
                className={`${fieldClass} rounded-xl`}
                required
                value={subjectForm.sectionId}
                onChange={(e) => setSubjectForm({ ...subjectForm, sectionId: e.target.value })}
              >
                <option value="">Select section</option>
                {subjectSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className={`${fieldClass} rounded-xl`}
                required
                value={subjectForm.subjectId}
                onChange={(e) => setSubjectForm({ ...subjectForm, subjectId: e.target.value })}
              >
                <option value="">Select subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className={`${fieldClass} rounded-xl`}
                required
                value={subjectForm.staffId}
                onChange={(e) => setSubjectForm({ ...subjectForm, staffId: e.target.value })}
              >
                <option value="">Select teacher</option>
                {(map.data?.staff ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white"
              >
                Assign
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <div className="relative min-w-[16rem] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <input
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search teacher by name, department or email..."
            />
          </div>
          <select
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            value={dept}
            onChange={(e) => {
              setDept(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            type="button"
            className={cn(
              'inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium',
              more
                ? 'border-[#1e3a8a] bg-blue-50 text-[#1e3a8a]'
                : 'border-slate-200 bg-white text-slate-600',
            )}
            onClick={() => setMore((v) => !v)}
          >
            More Filters
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1e3a8a] px-3 text-sm font-medium text-white"
            onClick={exportCsv}
          >
            Export CSV
          </button>
        </div>
        {more ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-3 py-2 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={onlyAssigned}
                onChange={(e) => {
                  setOnlyAssigned(e.target.checked);
                  setPage(1);
                }}
              />
              Assigned teachers only
            </label>
            <button
              type="button"
              className="text-slate-500 hover:text-slate-800"
              onClick={() => {
                setQ('');
                setDept('');
                setStatus('');
                setOnlyAssigned(false);
                setPage(1);
              }}
            >
              Clear
            </button>
          </div>
        ) : null}

        {map.isLoading ? (
          <p className="p-6 text-sm text-slate-500">Loading teachers…</p>
        ) : !rows.length ? (
          <p className="p-6 text-sm text-slate-500">No teachers match the current filters.</p>
        ) : (
          <>
            <div className="overflow-auto">
              <table className="w-full min-w-[70rem] text-left text-sm">
                <thead className="bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3">#</th>
                    <th className="px-3 py-3">Teacher</th>
                    <th className="px-3 py-3">Department</th>
                    <th className="px-3 py-3">Class Teacher</th>
                    <th className="px-3 py-3">Subjects</th>
                    <th className="px-3 py-3">Periods / Week</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row, i) => {
                    const active = (row.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE';
                    return (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                        <td className="px-3 py-3 text-slate-400">
                          {(safePage - 1) * pageSize + i + 1}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                                tone(row.fullName, AVATAR_TONES),
                              )}
                            >
                              {initialsOf(row.fullName)}
                            </span>
                            <span>
                              <span className="block font-semibold text-slate-900">
                                {row.fullName}
                              </span>
                              <span className="block text-xs text-slate-500">
                                {row.email || row.employeeCode}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{row.department || '—'}</td>
                        <td className="px-3 py-3">
                          {row.classTeacherLabel ? (
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                tone(row.classTeacherLabel, CLASS_TONES),
                              )}
                            >
                              {row.classTeacherLabel}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {row.subjects ? (
                            <button
                              type="button"
                              className="font-medium text-sky-700 hover:underline"
                              onClick={() => setViewId(row.id)}
                            >
                              {row.subjects} subject{row.subjects === 1 ? '' : 's'}
                            </button>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="px-3 py-3">{row.periods}</td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                              active
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-slate-100 text-slate-500',
                            )}
                          >
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                active ? 'bg-emerald-500' : 'bg-slate-400',
                              )}
                            />
                            {active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="relative flex items-center justify-end gap-1">
                            <button
                              type="button"
                              className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              onClick={() => setViewId(row.id)}
                            >
                              View
                            </button>
                            {canManage ? (
                              <Link
                                href={`/admin/school-sis/staff/${row.id}`}
                                className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Edit
                              </Link>
                            ) : null}
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                              onClick={() => setMenuId((cur) => (cur === row.id ? null : row.id))}
                            >
                              ⋮
                            </button>
                            {menuId === row.id ? (
                              <div className="absolute right-0 top-9 z-20 min-w-[10rem] rounded-xl border border-slate-200 bg-white py-1 text-left text-sm shadow-lg">
                                <button
                                  className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                                  onClick={() => {
                                    setMenuId(null);
                                    setViewId(row.id);
                                  }}
                                >
                                  Workload
                                </button>
                                <Link
                                  href={`/admin/school-sis/staff/${row.id}`}
                                  className="block px-3 py-1.5 hover:bg-slate-50"
                                  onClick={() => setMenuId(null)}
                                >
                                  Open profile
                                </Link>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              <span>
                Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, rows.length)}{' '}
                of {rows.length} teachers
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    «
                  </button>
                  {pagerItems(safePage, pageCount).map((item, i) =>
                    item === '…' ? (
                      <span key={`e${i}`} className="px-1">
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPage(item)}
                        className={cn(
                          'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold',
                          item === safePage
                            ? 'bg-[#1e3a8a] text-white'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                        )}
                      >
                        {item}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                    disabled={safePage >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    »
                  </button>
                </div>
                <label className="inline-flex items-center gap-2">
                  Rows per page
                  <select
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    {[10, 20, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={!!viewId} onOpenChange={(open) => !open && setViewId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewing?.fullName ?? 'Teacher'}</DialogTitle>
            <DialogDescription>
              {viewing?.department || viewing?.designation || 'Teaching staff'} ·{' '}
              {viewing?.email || viewing?.employeeCode}
            </DialogDescription>
          </DialogHeader>
          {viewing ? (
            <div className="space-y-3 text-sm">
              <p>
                Class teacher:{' '}
                <span className="font-medium">{viewing.classTeacherLabel || 'Not assigned'}</span>
              </p>
              <p>Periods / week: {viewing.periods}</p>
              <div>
                <p className="mb-1 font-medium">Subjects</p>
                {(viewing.subjectList ?? []).length ? (
                  <ul className="space-y-1 text-slate-600">
                    {viewing.subjectList!.map((s, i) => (
                      <li key={`${s.name}-${i}`}>
                        {s.name} · {s.section} · {s.periods} periods
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500">No subject assignments.</p>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
