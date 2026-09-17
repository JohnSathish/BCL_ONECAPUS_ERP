'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  activateSchoolAcademicYear,
  archiveSchoolSection,
  assignSchoolSisClassTeacher,
  createSchoolSisSection,
  fetchSchoolAcademicClasses,
  fetchSchoolAcademicYears,
  fetchSchoolSisStaff,
  patchSchoolSection,
  saveSchoolGrade,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { confirmAction, fieldClass, GhostButton, PrimaryButton } from './academic-ui';

const CLASS_TONES = [
  'bg-rose-100 text-rose-800',
  'bg-amber-100 text-amber-800',
  'bg-violet-100 text-violet-800',
  'bg-orange-100 text-orange-800',
  'bg-pink-100 text-pink-800',
  'bg-sky-100 text-sky-800',
  'bg-emerald-100 text-emerald-800',
  'bg-indigo-100 text-indigo-800',
];

function classTone(name: string) {
  let n = 0;
  for (let i = 0; i < name.length; i += 1) n += name.charCodeAt(i);
  return CLASS_TONES[n % CLASS_TONES.length];
}

type SortKey = 'class' | 'section' | 'capacity' | 'students' | 'available' | 'teacher' | 'status';

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

export function AcademicClassesPanel() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['school-academic-classes'],
    queryFn: fetchSchoolAcademicClasses,
    enabled,
  });
  const years = useQuery({
    queryKey: ['school-academic-years'],
    queryFn: fetchSchoolAcademicYears,
    enabled,
  });
  const staff = useQuery({
    queryKey: ['school-sis-staff'],
    queryFn: fetchSchoolSisStaff,
    enabled: enabled && canManage,
  });
  const [error, setError] = useState<string | null>(null);
  const [className, setClassName] = useState('');
  const [sectionGrade, setSectionGrade] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [q, setQ] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('class');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    id: string;
    name: string;
    capacity: string;
    active: boolean;
    staffId: string;
    label: string;
  } | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['school-academic-classes'] });

  const addClass = useMutation({
    mutationFn: () => saveSchoolGrade({ name: className.trim() }),
    onSuccess: () => {
      setClassName('');
      setError(null);
      void refresh();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const addSection = useMutation({
    mutationFn: () =>
      createSchoolSisSection({
        gradeId: sectionGrade,
        name: sectionName.trim() || 'A',
        capacity: Number(capacity) || undefined,
      }),
    onSuccess: () => {
      setSectionName('');
      setCapacity('');
      setError(null);
      void refresh();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      await patchSchoolSection(editing.id, {
        name: editing.name.trim() || undefined,
        capacity: Number(editing.capacity) || undefined,
        active: editing.active,
      });
      if (editing.staffId) {
        await assignSchoolSisClassTeacher({
          sectionId: editing.id,
          staffId: editing.staffId,
        });
      }
    },
    onSuccess: () => {
      setEditing(null);
      setError(null);
      void refresh();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const grades = query.data?.grades ?? [];
  const yearName = query.data?.academicYear.name ?? '—';

  const rows = useMemo(() => {
    const list = (query.data?.sections ?? []).map((s) => {
      const students = s._count?.enrollments ?? 0;
      const cap = s.capacity ?? 0;
      return {
        ...s,
        students,
        available: cap ? Math.max(0, cap - students) : 0,
        teacher: s.classTeachers?.[0]?.staff.fullName ?? '',
        status: s.active === false ? 'inactive' : 'active',
      };
    });
    const term = q.trim().toLowerCase();
    const filtered = list.filter((s) => {
      if (gradeFilter && s.gradeId !== gradeFilter) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      if (term && !`${s.grade.name} ${s.name} ${s.teacher}`.toLowerCase().includes(term))
        return false;
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      const val = (row: (typeof filtered)[number]) => {
        if (sortKey === 'class') return row.grade.name;
        if (sortKey === 'section') return row.name;
        if (sortKey === 'capacity') return row.capacity ?? 0;
        if (sortKey === 'students') return row.students;
        if (sortKey === 'available') return row.available;
        if (sortKey === 'teacher') return row.teacher;
        return row.status;
      };
      const av = val(a);
      const bv = val(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
    });
    return filtered;
  }, [query.data, q, gradeFilter, statusFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const kpis = useMemo(() => {
    const sections = query.data?.sections ?? [];
    const uniqueTeachers = new Set(
      sections.map((s) => s.classTeachers?.[0]?.staff.id).filter((id): id is string => Boolean(id)),
    );
    const capacityTotal = sections.reduce((n, s) => n + (s.capacity ?? 0), 0);
    const studentsTotal = sections.reduce((n, s) => n + (s._count?.enrollments ?? 0), 0);
    const util = capacityTotal ? Math.round((studentsTotal / capacityTotal) * 1000) / 10 : 0;
    return {
      classes: grades.length,
      sections: sections.length,
      capacity: capacityTotal,
      students: studentsTotal,
      teachers: uniqueTeachers.size,
      util,
    };
  }, [query.data, grades.length]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const clearFilters = () => {
    setQ('');
    setGradeFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const exportCsv = () => {
    const header = 'Class,Section,Capacity,Students,Available,Class Teacher,Status';
    const body = rows
      .map((r) =>
        [r.grade.name, r.name, r.capacity ?? '', r.students, r.available, r.teacher, r.status]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'school-classes-sections.csv';
    a.click();
  };

  const SortTh = ({ k, children }: { k: SortKey; children: string }) => (
    <th className="px-3 py-3 text-left">
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
        onClick={() => toggleSort(k)}
      >
        {children}
        <span className="text-slate-300">
          {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );

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
              <path d="M22 10 12 5 2 10l10 5 10-5z" />
              <path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5" />
            </svg>
          </span>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Classes &amp; Sections</h1>
            <p className="text-sm text-slate-500">
              Manage classes, sections, capacity and class teachers for the academic year {yearName}
              .
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
            value={query.data?.academicYear.id ?? ''}
            onChange={(e) => {
              const id = e.target.value;
              if (!id || id === query.data?.academicYear.id) return;
              if (
                !confirmAction(
                  `Switch the current academic year to ${e.target.selectedOptions[0]?.text}?`,
                )
              )
                return;
              void activateSchoolAcademicYear(id)
                .then(() => {
                  void qc.invalidateQueries({ queryKey: ['school-academic-classes'] });
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
              <option value={query.data?.academicYear.id}>{yearName}</option>
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
            label: 'Total Classes',
            value: kpis.classes,
            sub: 'Across all sections',
            wrap: 'bg-blue-50/80',
            icon: 'bg-blue-100 text-blue-700',
            path: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
          },
          {
            label: 'Total Sections',
            value: kpis.sections,
            sub: 'Active sections',
            wrap: 'bg-emerald-50/80',
            icon: 'bg-emerald-100 text-emerald-700',
            path: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
          },
          {
            label: 'Total Capacity',
            value: kpis.capacity.toLocaleString(),
            sub: 'Total intake capacity',
            wrap: 'bg-violet-50/80',
            icon: 'bg-violet-100 text-violet-700',
            path: 'M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6',
          },
          {
            label: 'Total Students',
            value: kpis.students.toLocaleString(),
            sub: 'Enrolled students',
            wrap: 'bg-sky-50/80',
            icon: 'bg-sky-100 text-sky-700',
            path: 'M22 10 12 5 2 10l10 5 10-5zM6 12v5c0 1 3 3 6 3s6-2 6-3v-5',
          },
          {
            label: 'Assigned Teachers',
            value: kpis.teachers,
            sub: 'Class teachers',
            wrap: 'bg-amber-50/80',
            icon: 'bg-amber-100 text-amber-700',
            path: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
          },
          {
            label: 'Utilization',
            value: `${kpis.util}%`,
            sub: 'Capacity filled',
            wrap: 'bg-rose-50/80',
            icon: 'bg-rose-100 text-rose-700',
            path: 'M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z',
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
            <p className="mt-0.5 text-[11px] text-slate-500">{card.sub}</p>
          </div>
        ))}
      </div>

      {canManage ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <form
            className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              addClass.mutate();
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
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Add New Class</h2>
                <p className="text-xs text-slate-500">
                  Create a new class (e.g., Class 8, LKG, UKG, etc.)
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                className={`${fieldClass} min-w-[12rem] flex-1 rounded-xl`}
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="Enter class name (e.g., Class 8)"
                required
              />
              <button
                type="submit"
                disabled={addClass.isPending}
                className="inline-flex h-10 items-center rounded-xl bg-[#1e3a8a] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                + Add Class
              </button>
            </div>
          </form>
          <form
            className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              addSection.mutate();
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
                  <path d="M4 6h16M4 12h16M4 18h10" />
                </svg>
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Add New Section</h2>
                <p className="text-xs text-slate-500">Create a section for an existing class</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_0.8fr_auto]">
              <select
                className={`${fieldClass} rounded-xl`}
                value={sectionGrade}
                onChange={(e) => setSectionGrade(e.target.value)}
                required
              >
                <option value="">Select class</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <input
                className={`${fieldClass} rounded-xl`}
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                placeholder="Section name (e.g., A)"
              />
              <input
                className={`${fieldClass} rounded-xl`}
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="Capacity"
              />
              <button
                type="submit"
                disabled={addSection.isPending}
                className="inline-flex h-10 items-center rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                + Add Section
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
              placeholder="Search class or section..."
            />
          </div>
          <select
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            value={gradeFilter}
            onChange={(e) => {
              setGradeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Classes</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600"
            onClick={clearFilters}
          >
            Clear
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1e3a8a] px-3 text-sm font-medium text-white"
            onClick={exportCsv}
          >
            Export
          </button>
        </div>

        {query.isLoading ? (
          <p className="p-6 text-sm text-slate-500">Loading classes…</p>
        ) : !rows.length ? (
          <p className="p-6 text-sm text-slate-500">No sections match the current filters.</p>
        ) : (
          <>
            <div className="overflow-auto">
              <table className="w-full min-w-[64rem] text-left text-sm">
                <thead className="bg-[#f8fafc]">
                  <tr>
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      #
                    </th>
                    <SortTh k="class">Class</SortTh>
                    <SortTh k="section">Section</SortTh>
                    <SortTh k="capacity">Capacity</SortTh>
                    <SortTh k="students">Students</SortTh>
                    <SortTh k="available">Available</SortTh>
                    <SortTh k="teacher">Class Teacher</SortTh>
                    <SortTh k="status">Status</SortTh>
                    <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row, i) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                      <td className="px-3 py-3 text-slate-400">
                        {(safePage - 1) * pageSize + i + 1}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                            classTone(row.grade.name),
                          )}
                        >
                          {row.grade.name}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-800">{row.name}</td>
                      <td className="px-3 py-3">{row.capacity ?? '—'}</td>
                      <td className="px-3 py-3">{row.students}</td>
                      <td className="px-3 py-3 font-semibold text-emerald-600">{row.available}</td>
                      <td className="px-3 py-3 text-slate-500">
                        {row.teacher ? (
                          row.teacher
                        ) : (
                          <span className="text-slate-400">— Not assigned</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            row.status === 'active'
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              row.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400',
                            )}
                          />
                          {row.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="relative flex items-center justify-end gap-1">
                          {canManage ? (
                            <button
                              type="button"
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              onClick={() =>
                                setEditing({
                                  id: row.id,
                                  name: row.name,
                                  capacity: String(row.capacity ?? ''),
                                  active: row.status === 'active',
                                  staffId: row.classTeachers?.[0]?.staff.id ?? '',
                                  label: `${row.grade.name} ${row.name}`,
                                })
                              }
                            >
                              Edit
                            </button>
                          ) : null}
                          <Link
                            href={`/admin/school-sis/students?sectionId=${row.id}`}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Students
                          </Link>
                          {canManage ? (
                            <>
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
                                      void patchSchoolSection(row.id, {
                                        active: row.status !== 'active',
                                      })
                                        .then(() => refresh())
                                        .catch((err) => setError(apiErrorMessage(err)));
                                    }}
                                  >
                                    {row.status === 'active' ? 'Mark inactive' : 'Mark active'}
                                  </button>
                                  <button
                                    className="block w-full px-3 py-1.5 text-left text-rose-700 hover:bg-rose-50"
                                    onClick={() => {
                                      setMenuId(null);
                                      if (
                                        !confirmAction(
                                          `Archive section ${row.grade.name} ${row.name}? Students stay on record.`,
                                        )
                                      )
                                        return;
                                      void archiveSchoolSection(row.id)
                                        .then(() => refresh())
                                        .catch((err) => setError(apiErrorMessage(err)));
                                    }}
                                  >
                                    Archive
                                  </button>
                                </div>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              <span>
                Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, rows.length)}{' '}
                of {rows.length} classes
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    ‹
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
                    ›
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

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editing?.label}</DialogTitle>
            <DialogDescription>
              Update section name, capacity, status and class teacher.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <div className="grid gap-3">
              <label className="text-sm">
                <span className="text-slate-500">Section name</span>
                <input
                  className={`${fieldClass} mt-1`}
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-500">Capacity</span>
                <input
                  className={`${fieldClass} mt-1`}
                  type="number"
                  min={1}
                  value={editing.capacity}
                  onChange={(e) => setEditing({ ...editing, capacity: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-500">Class teacher</span>
                <select
                  className={`${fieldClass} mt-1`}
                  value={editing.staffId}
                  onChange={(e) => setEditing({ ...editing, staffId: e.target.value })}
                >
                  <option value="">Not assigned</option>
                  {(staff.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                Active
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <GhostButton type="button" onClick={() => setEditing(null)}>
              Cancel
            </GhostButton>
            <PrimaryButton
              type="button"
              disabled={saveEdit.isPending}
              onClick={() => saveEdit.mutate()}
            >
              Save
            </PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
