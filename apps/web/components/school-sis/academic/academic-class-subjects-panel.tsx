'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  activateSchoolAcademicYear,
  assignSchoolSisSubjectTeacher,
  bulkMapSchoolClassSubjects,
  fetchSchoolAcademicYears,
  fetchSchoolClassSubjectMatrix,
  fetchSchoolStaffMap,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { confirmAction, fieldClass } from './academic-ui';

const CLASS_TONES = [
  'bg-rose-100 text-rose-800',
  'bg-amber-100 text-amber-800',
  'bg-violet-100 text-violet-800',
  'bg-sky-100 text-sky-800',
  'bg-emerald-100 text-emerald-800',
  'bg-indigo-100 text-indigo-800',
];

function classTone(name: string) {
  let n = 0;
  for (let i = 0; i < name.length; i += 1) n += name.charCodeAt(i);
  return CLASS_TONES[n % CLASS_TONES.length];
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

export function AcademicClassSubjectsPanel() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['school-class-subjects'],
    queryFn: fetchSchoolClassSubjectMatrix,
    enabled,
  });
  const years = useQuery({
    queryKey: ['school-academic-years'],
    queryFn: fetchSchoolAcademicYears,
    enabled,
  });
  const staffMap = useQuery({
    queryKey: ['school-staff-map'],
    queryFn: fetchSchoolStaffMap,
    enabled: enabled && canManage,
  });
  const [error, setError] = useState<string | null>(null);
  const [gradeIds, setGradeIds] = useState<string[]>([]);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [assign, setAssign] = useState({
    gradeId: '',
    sectionId: '',
    subjectId: '',
    staffId: '',
  });
  const [q, setQ] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const yearName = query.data?.academicYear.name ?? '—';
  const yearId = query.data?.academicYear.id ?? '';
  const grades = query.data?.grades ?? [];
  const subjects = query.data?.subjects ?? [];
  const allRows = query.data?.rows ?? [];

  const types = useMemo(() => {
    const set = new Set(allRows.map((r) => r.subjectType).filter((t): t is string => Boolean(t)));
    return [...set].sort();
  }, [allRows]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return allRows.filter((r) => {
      if (gradeFilter && r.gradeId !== gradeFilter) return false;
      if (typeFilter && r.subjectType !== typeFilter) return false;
      if (teacherFilter === 'assigned' && !r.teacher) return false;
      if (teacherFilter === 'unassigned' && r.teacher) return false;
      if (
        term &&
        !`${r.className} ${r.sectionName} ${r.subjectName ?? ''} ${r.teacher?.fullName ?? ''}`
          .toLowerCase()
          .includes(term)
      )
        return false;
      return true;
    });
  }, [allRows, q, gradeFilter, typeFilter, teacherFilter]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const kpis = useMemo(() => {
    const mapped = allRows.filter((r) => r.subjectId);
    const classes = new Set(mapped.map((r) => r.gradeId)).size;
    const subjectCount = new Set(mapped.map((r) => r.subjectId)).size;
    const assigned = mapped.filter((r) => r.teacher).length;
    const unassigned = mapped.filter((r) => !r.teacher).length;
    const coverage = mapped.length ? Math.round((assigned / mapped.length) * 100) : 0;
    return {
      mappings: mapped.length,
      classes,
      subjects: subjectCount,
      assigned,
      unassigned,
      coverage,
    };
  }, [allRows]);

  const assignSections = allRows.filter((r) => !assign.gradeId || r.gradeId === assign.gradeId);
  const sectionOptions = useMemo(() => {
    const seen = new Set<string>();
    return assignSections
      .filter((r) => {
        if (seen.has(r.sectionId)) return false;
        seen.add(r.sectionId);
        return true;
      })
      .map((r) => ({ id: r.sectionId, name: r.sectionName, gradeId: r.gradeId }));
  }, [assignSections]);
  const subjectOptions = useMemo(() => {
    const seen = new Set<string>();
    return assignSections
      .filter((r) => r.subjectId && (!assign.sectionId || r.sectionId === assign.sectionId))
      .filter((r) => {
        const id = r.subjectId!;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map((r) => ({ id: r.subjectId!, name: r.subjectName ?? 'Subject' }));
  }, [assignSections, assign.sectionId]);

  const save = useMutation({
    mutationFn: () => bulkMapSchoolClassSubjects({ gradeIds, subjectIds }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['school-class-subjects'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const exportCsv = () => {
    const header = 'Class,Section,Subject,Type,Teacher';
    const body = rows
      .map((r) =>
        [
          r.className,
          r.sectionName,
          r.subjectName ?? '',
          r.subjectType ?? '',
          r.teacher?.fullName ?? '',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'school-class-subjects.csv';
    a.click();
  };

  const toggle = (list: string[], id: string, set: (next: string[]) => void) => {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
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
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </span>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Class-wise subjects</h1>
            <p className="text-sm text-slate-500">
              Map subjects to classes for {yearName}, then assign a subject teacher on each section.
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
                  void qc.invalidateQueries({ queryKey: ['school-class-subjects'] });
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
            label: 'Mappings',
            value: kpis.mappings,
            wrap: 'bg-blue-50/80',
            icon: 'bg-blue-100 text-blue-700',
          },
          {
            label: 'Classes',
            value: kpis.classes,
            wrap: 'bg-emerald-50/80',
            icon: 'bg-emerald-100 text-emerald-700',
          },
          {
            label: 'Subjects',
            value: kpis.subjects,
            wrap: 'bg-violet-50/80',
            icon: 'bg-violet-100 text-violet-700',
          },
          {
            label: 'Teachers assigned',
            value: kpis.assigned,
            wrap: 'bg-sky-50/80',
            icon: 'bg-sky-100 text-sky-700',
          },
          {
            label: 'Unassigned',
            value: kpis.unassigned,
            wrap: 'bg-amber-50/80',
            icon: 'bg-amber-100 text-amber-700',
          },
          {
            label: 'Coverage',
            value: `${kpis.coverage}%`,
            wrap: 'bg-rose-50/80',
            icon: 'bg-rose-100 text-rose-700',
          },
        ].map((card) => (
          <div
            key={card.label}
            className={cn('rounded-2xl border border-white/70 p-3 shadow-sm', card.wrap)}
          >
            <p className="text-[11px] font-medium text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {canManage ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Bulk map subjects</h2>
            <p className="mb-3 text-xs text-slate-500">
              Choose one or more classes and the subjects they study. This replaces the current map
              for those classes.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-600">Classes</p>
                <div className="grid max-h-40 gap-1 overflow-auto rounded-xl border border-blue-100 bg-white p-2">
                  {grades.map((g) => (
                    <label key={g.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={gradeIds.includes(g.id)}
                        onChange={() => toggle(gradeIds, g.id, setGradeIds)}
                      />
                      {g.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-600">Subjects</p>
                <div className="grid max-h-40 gap-1 overflow-auto rounded-xl border border-blue-100 bg-white p-2">
                  {subjects.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={subjectIds.includes(s.id)}
                        onChange={() => toggle(subjectIds, s.id, setSubjectIds)}
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={!gradeIds.length || !subjectIds.length || save.isPending}
              onClick={() => save.mutate()}
              className="mt-3 inline-flex h-10 items-center rounded-xl bg-[#1e3a8a] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {save.isPending ? 'Saving…' : 'Apply mapping'}
            </button>
          </div>
          <form
            className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              void assignSchoolSisSubjectTeacher({
                sectionId: assign.sectionId,
                subjectId: assign.subjectId,
                staffId: assign.staffId,
              })
                .then(() => {
                  setError(null);
                  void qc.invalidateQueries({ queryKey: ['school-class-subjects'] });
                  void qc.invalidateQueries({ queryKey: ['school-staff-map'] });
                })
                .catch((err) => setError(apiErrorMessage(err)));
            }}
          >
            <h2 className="text-sm font-semibold text-slate-900">Assign subject teacher</h2>
            <p className="mb-3 text-xs text-slate-500">
              Set who teaches a mapped subject in a section.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                className={`${fieldClass} rounded-xl`}
                required
                value={assign.gradeId}
                onChange={(e) =>
                  setAssign({
                    gradeId: e.target.value,
                    sectionId: '',
                    subjectId: '',
                    staffId: assign.staffId,
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
                value={assign.sectionId}
                onChange={(e) => setAssign({ ...assign, sectionId: e.target.value, subjectId: '' })}
              >
                <option value="">Select section</option>
                {sectionOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className={`${fieldClass} rounded-xl`}
                required
                value={assign.subjectId}
                onChange={(e) => setAssign({ ...assign, subjectId: e.target.value })}
              >
                <option value="">Select subject</option>
                {subjectOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className={`${fieldClass} rounded-xl`}
                required
                value={assign.staffId}
                onChange={(e) => setAssign({ ...assign, staffId: e.target.value })}
              >
                <option value="">Select teacher</option>
                {(staffMap.data?.staff ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="mt-3 inline-flex h-10 items-center rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white"
            >
              Assign teacher
            </button>
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
              placeholder="Search class, subject or teacher..."
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
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            value={teacherFilter}
            onChange={(e) => {
              setTeacherFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Teachers</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </select>
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-xl bg-[#1e3a8a] px-3 text-sm font-medium text-white"
            onClick={exportCsv}
          >
            Export CSV
          </button>
        </div>
        {query.isLoading ? (
          <p className="p-6 text-sm text-slate-500">Loading mappings…</p>
        ) : !rows.length ? (
          <p className="p-6 text-sm text-slate-500">No mappings match the current filters.</p>
        ) : (
          <>
            <div className="overflow-auto">
              <table className="w-full min-w-[64rem] text-left text-sm">
                <thead className="bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3">#</th>
                    <th className="px-3 py-3">Class</th>
                    <th className="px-3 py-3">Section</th>
                    <th className="px-3 py-3">Subject</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Subject Teacher</th>
                    <th className="px-3 py-3">Status</th>
                    {canManage ? <th className="px-3 py-3 text-right">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row, i) => (
                    <tr
                      key={`${row.sectionId}-${row.subjectId ?? i}`}
                      className="border-t border-slate-100 hover:bg-slate-50/80"
                    >
                      <td className="px-3 py-3 text-slate-400">
                        {(safePage - 1) * pageSize + i + 1}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                            classTone(row.className),
                          )}
                        >
                          {row.className}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-medium">{row.sectionName}</td>
                      <td className="px-3 py-3">{row.subjectName ?? '—'}</td>
                      <td className="px-3 py-3 text-slate-500">{row.subjectType ?? '—'}</td>
                      <td className="px-3 py-3">
                        {row.teacher?.fullName ?? (
                          <span className="text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            row.teacher
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-amber-50 text-amber-800',
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              row.teacher ? 'bg-emerald-500' : 'bg-amber-500',
                            )}
                          />
                          {row.teacher ? 'Assigned' : 'Pending'}
                        </span>
                      </td>
                      {canManage ? (
                        <td className="px-3 py-3 text-right">
                          {row.subjectId ? (
                            <button
                              type="button"
                              className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              onClick={() =>
                                setAssign({
                                  gradeId: row.gradeId,
                                  sectionId: row.sectionId,
                                  subjectId: row.subjectId ?? '',
                                  staffId: row.teacher?.id ?? '',
                                })
                              }
                            >
                              Assign
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">Map subjects first</span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              <span>
                Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, rows.length)}{' '}
                of {rows.length} rows
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
    </div>
  );
}
