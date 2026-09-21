'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FlaskConical,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  assignSchoolSisSubjectGrades,
  createSchoolSisSubject,
  createSchoolSisSubjectType,
  deleteSchoolSisSubject,
  deleteSchoolSisSubjectType,
  fetchSchoolSisCurriculum,
  saveSchoolSisClassSubjects,
  updateSchoolSisSubject,
  updateSchoolSisSubjectType,
  type SchoolSisSubject,
  type SchoolSisSubjectType,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const TABS = [
  { id: 'list', label: 'Subjects' },
  { id: 'types', label: 'Subject Types' },
  { id: 'classwise', label: 'Class-wise Subjects' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const PRIMARY = 'var(--school-erp-primary,#1e3a8a)';

export function SchoolSisCurriculumPage() {
  const enabled = useAuthQueryEnabled();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.session?.user);
  const canManage = canManageSchoolSis(user?.permissions);
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'list') as TabId;
  const query = useQuery({
    queryKey: ['school-sis-curriculum'],
    queryFn: fetchSchoolSisCurriculum,
    enabled,
  });
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const setTab = (next: TabId) => {
    router.replace(`${pathname}?tab=${next}`);
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ['school-sis-curriculum'] });
  const subjects = query.data?.subjects ?? [];
  const types = query.data?.types ?? [];
  const grades = query.data?.grades ?? [];
  const mappings = query.data?.mappings ?? [];
  const yearName = query.data?.academicYear.name ?? '—';

  const stats = useMemo(() => {
    const total = subjects.length;
    const main = subjects.filter(
      (s) => (s.subjectType?.code ?? '').toUpperCase() === 'MAIN',
    ).length;
    const practical = subjects.filter((s) => s.hasPractical).length;
    const assigned = subjects.filter((s) => (s.classCount ?? 0) > 0).length;
    return { total, main, practical, assigned };
  }, [subjects]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">
            Academics <span className="mx-1 text-slate-300">›</span> Subjects & Curriculum
          </p>
          <div className="mt-1 flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[color:var(--school-erp-primary,#1e3a8a)]">
              <BookOpen className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Subjects & Curriculum
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Manage subjects, subject types, marks, and class-wise curriculum assignments.
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
              <p className="text-sm font-semibold text-slate-800">{yearName}</p>
            </div>
          </div>
          <Link
            href="/admin/school-sis/academic/years"
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Change Year
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<Layers className="h-4 w-4" />}
          label="Total Subjects"
          value={stats.total}
          hint={`${stats.total ? 'Catalogue' : 'None yet'}`}
          tone="navy"
        />
        <KpiCard
          icon={<BookOpen className="h-4 w-4" />}
          label="Main Subjects"
          value={stats.main}
          hint={pct(stats.main, stats.total)}
          tone="blue"
        />
        <KpiCard
          icon={<FlaskConical className="h-4 w-4" />}
          label="Practical Subjects"
          value={stats.practical}
          hint={pct(stats.practical, stats.total)}
          tone="green"
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Assigned to Classes"
          value={stats.assigned}
          hint={pct(stats.assigned, stats.total, 'assigned')}
          tone="sky"
        />
      </section>

      <div
        role="tablist"
        aria-label="Subject management"
        className="inline-flex w-full gap-1 overflow-x-auto rounded-full border border-slate-200 bg-slate-100 p-1 sm:w-auto"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              'shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition',
              tab === item.id
                ? 'bg-[var(--school-erp-primary,#1e3a8a)] text-white'
                : 'text-slate-600 hover:bg-white',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <p
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {query.isLoading ? (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : null}

      {tab === 'types' ? (
        <TypesPanel
          rows={types}
          canManage={canManage}
          onError={setError}
          onDone={() => void refresh()}
        />
      ) : null}
      {tab === 'list' ? (
        <SubjectsPanel
          rows={subjects}
          types={types}
          grades={grades}
          canManage={canManage}
          nameInputRef={nameInputRef}
          onError={setError}
          onDone={() => void refresh()}
        />
      ) : null}
      {tab === 'classwise' ? (
        <ClasswisePanel
          grades={grades}
          subjects={subjects}
          mappings={mappings}
          canManage={canManage}
          onError={setError}
          onSaved={() => void refresh()}
        />
      ) : null}
    </div>
  );
}

function pct(part: number, total: number, suffix = 'of total') {
  if (!total) return '—';
  return `${Math.round((part / total) * 100)}% ${suffix}`;
}

function KpiCard({
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
  tone: 'navy' | 'blue' | 'green' | 'sky';
}) {
  const tones = {
    navy: 'bg-slate-50 text-slate-700',
    blue: 'bg-indigo-50 text-indigo-700',
    green: 'bg-emerald-50 text-emerald-700',
    sky: 'bg-sky-50 text-sky-700',
  };
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
          <p className="mt-1 text-xs font-medium text-emerald-600">{hint}</p>
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

type GradeOpt = { id: string; name: string };

function SubjectsPanel({
  rows,
  types,
  grades,
  canManage,
  nameInputRef,
  onError,
  onDone,
}: {
  rows: SchoolSisSubject[];
  types: SchoolSisSubjectType[];
  grades: GradeOpt[];
  canManage: boolean;
  nameInputRef: React.RefObject<HTMLInputElement | null>;
  onError: (msg: string | null) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [typeId, setTypeId] = useState(
    types.find((t) => t.code === 'MAIN')?.id ?? types[0]?.id ?? '',
  );
  const [maxMarks, setMaxMarks] = useState('100');
  const [passMarks, setPassMarks] = useState('33');
  const [practicalMax, setPracticalMax] = useState('0');
  const [practicalPass, setPracticalPass] = useState('0');
  const [hasTheory, setHasTheory] = useState(true);
  const [hasPractical, setHasPractical] = useState(false);
  const [editing, setEditing] = useState<SchoolSisSubject | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [drawer, setDrawer] = useState<SchoolSisSubject | null>(null);
  const [assignTarget, setAssignTarget] = useState<SchoolSisSubject[] | null>(null);
  const [typeTarget, setTypeTarget] = useState<SchoolSisSubject[] | null>(null);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    body: string;
    danger?: boolean;
    confirmLabel: string;
    onConfirm: () => void;
  }>(null);
  const [usageWarn, setUsageWarn] = useState<null | { ids: string[]; message: string }>(null);

  useEffect(() => {
    if (!typeId && types[0]?.id) setTypeId(types.find((t) => t.code === 'MAIN')?.id ?? types[0].id);
  }, [types, typeId]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, kindFilter, statusFilter, classFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (q && !`${row.name} ${row.code}`.toLowerCase().includes(q)) return false;
      if (typeFilter !== 'all' && (row.subjectTypeId || row.subjectType?.id) !== typeFilter)
        return false;
      if (kindFilter === 'theory' && row.hasTheory === false) return false;
      if (kindFilter === 'practical' && !row.hasPractical) return false;
      if (kindFilter === 'both' && !(row.hasTheory !== false && row.hasPractical)) return false;
      if (statusFilter === 'active' && row.active === false) return false;
      if (statusFilter === 'inactive' && row.active !== false) return false;
      if (classFilter === 'assigned' && !(row.classCount ?? 0)) return false;
      if (classFilter === 'unassigned' && (row.classCount ?? 0) > 0) return false;
      if (classFilter !== 'all' && classFilter !== 'assigned' && classFilter !== 'unassigned') {
        if (!(row.classIds ?? []).includes(classFilter)) return false;
      }
      return true;
    });
  }, [rows, search, typeFilter, kindFilter, statusFilter, classFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selectedRows = rows.filter((r) => selected.has(r.id));

  const resetForm = () => {
    setEditing(null);
    setName('');
    setCode('');
    setMaxMarks('100');
    setPassMarks('33');
    setPracticalMax('0');
    setPracticalPass('0');
    setHasTheory(true);
    setHasPractical(false);
    setFieldErrors({});
    setTypeId(types.find((t) => t.code === 'MAIN')?.id ?? types[0]?.id ?? '');
  };

  const fillForm = (row: SchoolSisSubject) => {
    setEditing(row);
    setName(row.name);
    setCode(row.code);
    setTypeId(row.subjectTypeId || row.subjectType?.id || '');
    setMaxMarks(String(row.maxMarks ?? 100));
    setPassMarks(String(row.passMarks ?? 33));
    setPracticalMax(row.hasPractical ? String(row.maxMarks ?? 0) : '0');
    setPracticalPass(row.hasPractical ? String(row.passMarks ?? 0) : '0');
    setHasTheory(row.hasTheory !== false);
    setHasPractical(Boolean(row.hasPractical));
    setFieldErrors({});
    nameInputRef.current?.focus();
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Subject name is required.';
    if (!code.trim()) next.code = 'Subject code is required.';
    else {
      const slug = code.trim().toUpperCase();
      const clash = rows.find((r) => r.code.toUpperCase() === slug && r.id !== editing?.id);
      if (clash) next.code = `Code ${clash.code} is already used by ${clash.name}.`;
    }
    if (!typeId) next.type = 'Subject type is required.';
    const max = maxMarks === '' ? null : Number(maxMarks);
    const pass = passMarks === '' ? null : Number(passMarks);
    if (max !== null && Number.isNaN(max)) next.maxMarks = 'Enter a valid number.';
    if (pass !== null && Number.isNaN(pass)) next.passMarks = 'Enter a valid number.';
    if (max !== null && pass !== null && pass > max) {
      next.passMarks = 'Pass marks cannot exceed maximum marks.';
    }
    if (!hasTheory && !hasPractical) next.kind = 'Turn on Theory, Practical, or both.';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        code: code.trim(),
        subjectTypeId: typeId || undefined,
        maxMarks: maxMarks ? Number(maxMarks) : undefined,
        passMarks: passMarks ? Number(passMarks) : undefined,
        hasTheory,
        hasPractical,
        isOptional: types.find((t) => t.id === typeId)?.code === 'OPTIONAL',
      };
      if (editing) return updateSchoolSisSubject(editing.id, payload);
      return createSchoolSisSubject(payload);
    },
    onSuccess: () => {
      onError(null);
      resetForm();
      onDone();
    },
    onError: (err) => onError(apiErrorMessage(err)),
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allOnPageSelected = paged.length > 0 && paged.every((r) => selected.has(r.id));

  const patchStatus = async (targets: SchoolSisSubject[], active: boolean) => {
    onError(null);
    try {
      for (const row of targets) {
        await updateSchoolSisSubject(row.id, { name: row.name, active });
      }
      setSelected(new Set());
      onDone();
    } catch (err) {
      onError(apiErrorMessage(err));
    }
  };

  const tryDelete = async (targets: SchoolSisSubject[]) => {
    onError(null);
    const blocked: string[] = [];
    let message = '';
    for (const row of targets) {
      try {
        await deleteSchoolSisSubject(row.id);
      } catch (err) {
        blocked.push(row.id);
        message = apiErrorMessage(err);
      }
    }
    setSelected(new Set());
    onDone();
    if (blocked.length) setUsageWarn({ ids: blocked, message });
  };

  const duplicate = async (row: SchoolSisSubject) => {
    const used = new Set(rows.map((r) => r.code.toUpperCase()));
    let nextCode = `${row.code}2`.slice(0, 20);
    let n = 2;
    while (used.has(nextCode.toUpperCase())) {
      n += 1;
      nextCode = `${row.code}${n}`.slice(0, 20);
    }
    onError(null);
    try {
      await createSchoolSisSubject({
        name: `${row.name} (copy)`,
        code: nextCode,
        subjectTypeId: row.subjectTypeId || row.subjectType?.id || undefined,
        maxMarks: row.maxMarks ?? undefined,
        passMarks: row.passMarks ?? undefined,
        hasTheory: row.hasTheory !== false,
        hasPractical: Boolean(row.hasPractical),
        isOptional: row.isOptional,
      });
      onDone();
    } catch (err) {
      onError(apiErrorMessage(err));
    }
  };

  const exportCsv = () => {
    const header = [
      'Subject',
      'Code',
      'Type',
      'Theory',
      'Practical',
      'Max',
      'Pass',
      'Classes',
      'Status',
    ];
    const lines = filtered.map((r) =>
      [
        r.name,
        r.code,
        r.subjectType?.name ?? '',
        r.hasTheory !== false ? 'Yes' : 'No',
        r.hasPractical ? 'Yes' : 'No',
        r.maxMarks ?? '',
        r.passMarks ?? '',
        r.classCount ?? 0,
        r.active === false ? 'Inactive' : 'Active',
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subjects.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtersActive =
    search ||
    typeFilter !== 'all' ||
    kindFilter !== 'all' ||
    statusFilter !== 'all' ||
    classFilter !== 'all';

  return (
    <div className="space-y-4">
      {canManage ? (
        <form
          className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!validate()) return;
            save.mutate();
          }}
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[color:var(--school-erp-primary,#1e3a8a)] text-white">
              <Plus className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {editing ? `Edit ${editing.name}` : 'Add New Subject'}
              </h2>
              <p className="text-xs text-slate-500">
                {editing
                  ? 'Class assignments stay unchanged unless you use Assign Classes.'
                  : 'Fill in the details below to add a new subject to the catalogue.'}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Field label="Subject Name *" error={fieldErrors.name}>
              <input
                ref={nameInputRef}
                id="add-subject-name"
                className={inputClass(fieldErrors.name)}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFieldErrors((p) => ({ ...p, name: '' }));
                }}
                placeholder="Enter subject name"
                aria-invalid={Boolean(fieldErrors.name)}
              />
            </Field>
            <Field label="Subject Code *" error={fieldErrors.code}>
              <input
                className={inputClass(fieldErrors.code)}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setFieldErrors((p) => ({ ...p, code: '' }));
                }}
                placeholder="e.g. ENG"
                aria-invalid={Boolean(fieldErrors.code)}
              />
            </Field>
            <Field label="Subject Type *" error={fieldErrors.type}>
              <select
                className={inputClass(fieldErrors.type)}
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                aria-invalid={Boolean(fieldErrors.type)}
              >
                <option value="">Select type</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Maximum Marks" error={fieldErrors.maxMarks}>
              <input
                className={inputClass(fieldErrors.maxMarks)}
                inputMode="numeric"
                value={maxMarks}
                onChange={(e) => setMaxMarks(e.target.value)}
              />
            </Field>
            <Field label="Pass Marks" error={fieldErrors.passMarks}>
              <input
                className={inputClass(fieldErrors.passMarks)}
                inputMode="numeric"
                value={passMarks}
                onChange={(e) => setPassMarks(e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <Toggle checked={hasTheory} onChange={setHasTheory} label="Theory" />
            <Toggle checked={hasPractical} onChange={setHasPractical} label="Practical" />
            <Field label="Practical Maximum Marks">
              <input
                className={inputClass()}
                inputMode="numeric"
                disabled={!hasPractical}
                value={practicalMax}
                onChange={(e) => setPracticalMax(e.target.value)}
              />
            </Field>
            <Field label="Practical Pass Marks">
              <input
                className={inputClass()}
                inputMode="numeric"
                disabled={!hasPractical}
                value={practicalPass}
                onChange={(e) => setPracticalPass(e.target.value)}
              />
            </Field>
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Reset
              </button>
              <button
                type="submit"
                disabled={save.isPending}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[var(--school-erp-primary,#1e3a8a)] px-4 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" aria-hidden />
                {editing ? 'Save Subject' : 'Add Subject'}
              </button>
            </div>
          </div>
          {fieldErrors.kind ? (
            <p className="mt-2 text-xs text-rose-600">{fieldErrors.kind}</p>
          ) : null}
          {hasPractical ? (
            <p className="mt-2 text-xs text-slate-400">
              Catalogue maximum and pass marks are stored on the subject. Practical components for
              examinations are configured in Examinations.
            </p>
          ) : null}
        </form>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[12rem] flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
              aria-hidden
            />
            <input
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[color:var(--school-erp-primary,#1e3a8a)]"
              placeholder="Search subjects by name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search subjects"
            />
          </label>
          <select
            className={filterClass}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Subject type"
          >
            <option value="all">All Types</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            className={filterClass}
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            aria-label="Theory or practical"
          >
            <option value="all">All</option>
            <option value="theory">Theory</option>
            <option value="practical">Practical</option>
            <option value="both">Theory & Practical</option>
          </select>
          <select
            className={filterClass}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Status"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            className={filterClass}
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            aria-label="Class assigned"
          >
            <option value="all">All Classes</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setTypeFilter('all');
              setKindFilter('all');
              setStatusFilter('all');
              setClassFilter('all');
            }}
            className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Reset Filters
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export
          </button>
        </div>

        {selected.size > 0 && canManage ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <span className="text-sm font-medium text-slate-600">{selected.size} selected</span>
            <BulkBtn onClick={() => setAssignTarget(selectedRows)}>Assign to Classes</BulkBtn>
            <BulkBtn onClick={() => setTypeTarget(selectedRows)}>Change Type</BulkBtn>
            <BulkBtn
              onClick={() =>
                setConfirm({
                  title: 'Activate subjects',
                  body: `Activate ${selected.size} selected subject(s)?`,
                  confirmLabel: 'Activate',
                  onConfirm: () => void patchStatus(selectedRows, true),
                })
              }
            >
              Activate
            </BulkBtn>
            <BulkBtn
              onClick={() =>
                setConfirm({
                  title: 'Deactivate subjects',
                  body: `Deactivate ${selected.size} selected subject(s)? They remain assigned to classes but are hidden from new mapping.`,
                  confirmLabel: 'Deactivate',
                  onConfirm: () => void patchStatus(selectedRows, false),
                })
              }
            >
              Deactivate
            </BulkBtn>
            <BulkBtn
              danger
              onClick={() =>
                setConfirm({
                  title: 'Delete subjects',
                  body: 'Subjects already used in classes, exams, timetable or marks cannot be deleted. Those will stay and you can deactivate them instead.',
                  confirmLabel: 'Delete unused',
                  danger: true,
                  onConfirm: () => void tryDelete(selectedRows),
                })
              }
            >
              Delete
            </BulkBtn>
          </div>
        ) : null}

        {!rows.length ? (
          <EmptyBlock
            title="No Subjects Added Yet"
            hint="Create your first subject to start building the school's curriculum."
            action={
              canManage ? (
                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-1 rounded-xl bg-[var(--school-erp-primary,#1e3a8a)] px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => nameInputRef.current?.focus()}
                >
                  <Plus className="h-4 w-4" /> Add Subject
                </button>
              ) : null
            }
          />
        ) : !filtered.length ? (
          <EmptyBlock
            title="No subjects match these filters"
            hint="Try a different search, type, or class — or reset filters to see the full catalogue."
            action={
              filtersActive ? (
                <button
                  type="button"
                  className="mt-4 text-sm font-medium text-[color:var(--school-erp-primary,#1e3a8a)] underline"
                  onClick={() => {
                    setSearch('');
                    setTypeFilter('all');
                    setKindFilter('all');
                    setStatusFilter('all');
                    setClassFilter('all');
                  }}
                >
                  Reset Filters
                </button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="w-10 px-2 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select all on this page"
                        checked={allOnPageSelected}
                        onChange={() => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (allOnPageSelected) paged.forEach((r) => next.delete(r.id));
                            else paged.forEach((r) => next.add(r.id));
                            return next;
                          });
                        }}
                      />
                    </th>
                    <th className="px-2 py-3">#</th>
                    <th className="px-2 py-3">Subject</th>
                    <th className="px-2 py-3">Code</th>
                    <th className="px-2 py-3">Type</th>
                    <th className="px-2 py-3">Theory</th>
                    <th className="px-2 py-3">Practical</th>
                    <th className="px-2 py-3">Marks</th>
                    <th className="px-2 py-3">Classes</th>
                    <th className="px-2 py-3">Status</th>
                    <th className="px-2 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row, i) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                    >
                      <td className="px-2 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.name}`}
                          checked={selected.has(row.id)}
                          onChange={() => toggleSelect(row.id)}
                        />
                      </td>
                      <td className="px-2 py-3 text-slate-400">
                        {(safePage - 1) * pageSize + i + 1}
                      </td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          className="flex items-center gap-2 text-left font-medium text-slate-800"
                          onClick={() => setDrawer(row)}
                        >
                          <SubjectGlyph name={row.name} />
                          {row.name}
                        </button>
                      </td>
                      <td className="px-2 py-3 font-mono text-xs text-slate-500">{row.code}</td>
                      <td className="px-2 py-3">
                        <TypeChip label={row.subjectType?.name ?? '—'} />
                      </td>
                      <td className="px-2 py-3">
                        {row.hasTheory !== false ? <YesDot /> : <NoDot />}
                      </td>
                      <td className="px-2 py-3">
                        {row.hasPractical ? <YesDot blue /> : <NoDot />}
                      </td>
                      <td className="px-2 py-3 text-slate-600">
                        {row.maxMarks ?? '—'} / {row.passMarks ?? '—'}
                      </td>
                      <td className="px-2 py-3 text-slate-600">{row.classCount ?? 0}</td>
                      <td className="px-2 py-3">
                        <StatusChip active={row.active !== false} />
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex justify-end gap-0.5">
                          <IconAction label="View" onClick={() => setDrawer(row)}>
                            <Eye className="h-4 w-4" />
                          </IconAction>
                          {canManage ? (
                            <>
                              <IconAction label="Edit" onClick={() => fillForm(row)}>
                                <Pencil className="h-4 w-4" />
                              </IconAction>
                              <IconAction label="Duplicate" onClick={() => void duplicate(row)}>
                                <Copy className="h-4 w-4" />
                              </IconAction>
                              <IconAction
                                label="Assign Classes"
                                onClick={() => setAssignTarget([row])}
                              >
                                <Users className="h-4 w-4" />
                              </IconAction>
                              <IconAction
                                label="Delete"
                                danger
                                onClick={() =>
                                  setConfirm({
                                    title: `Delete ${row.name}?`,
                                    body: 'If this subject is used in classes, exams, timetable or marks it cannot be deleted. You can deactivate it instead.',
                                    confirmLabel: 'Delete',
                                    danger: true,
                                    onConfirm: () => void tryDelete([row]),
                                  })
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </IconAction>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 grid gap-3 md:hidden">
              {paged.map((row) => (
                <article key={row.id} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      aria-label={`Select ${row.name}`}
                      checked={selected.has(row.id)}
                      onChange={() => toggleSelect(row.id)}
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setDrawer(row)}
                    >
                      <div className="flex items-center gap-2">
                        <SubjectGlyph name={row.name} />
                        <div>
                          <p className="font-semibold text-slate-800">{row.name}</p>
                          <p className="text-xs text-slate-500">
                            {row.code} · {row.subjectType?.name ?? '—'}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Marks {row.maxMarks ?? '—'} / {row.passMarks ?? '—'} · Classes{' '}
                        {row.classCount ?? 0}
                      </p>
                    </button>
                    <StatusChip active={row.active !== false} />
                  </div>
                  {canManage ? (
                    <div className="mt-3 flex justify-end gap-1">
                      <IconAction label="Edit" onClick={() => fillForm(row)}>
                        <Pencil className="h-4 w-4" />
                      </IconAction>
                      <IconAction label="Assign Classes" onClick={() => setAssignTarget([row])}>
                        <Users className="h-4 w-4" />
                      </IconAction>
                      <IconAction label="View" onClick={() => setDrawer(row)}>
                        <Eye className="h-4 w-4" />
                      </IconAction>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <p>
                Showing {(safePage - 1) * pageSize + 1} to{' '}
                {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} subjects
              </p>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1">
                  Rows per page
                  <select
                    className="h-8 rounded-lg border border-slate-200 px-2"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    {[10, 25, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 p-1 disabled:opacity-40"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[2rem] text-center font-semibold text-slate-700">
                  {safePage}
                </span>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 p-1 disabled:opacity-40"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {drawer ? (
        <DetailsDrawer
          row={drawer}
          canManage={canManage}
          onClose={() => setDrawer(null)}
          onEdit={() => {
            fillForm(drawer);
            setDrawer(null);
          }}
          onAssign={() => {
            setAssignTarget([drawer]);
            setDrawer(null);
          }}
        />
      ) : null}

      {assignTarget ? (
        <AssignModal
          subjects={assignTarget}
          grades={grades}
          onClose={() => setAssignTarget(null)}
          onSaved={() => {
            setAssignTarget(null);
            setSelected(new Set());
            onDone();
          }}
          onError={onError}
        />
      ) : null}

      {typeTarget ? (
        <ChangeTypeModal
          subjects={typeTarget}
          types={types}
          onClose={() => setTypeTarget(null)}
          onSaved={() => {
            setTypeTarget(null);
            setSelected(new Set());
            onDone();
          }}
          onError={onError}
        />
      ) : null}

      {confirm ? (
        <ConfirmDialog
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const fn = confirm.onConfirm;
            setConfirm(null);
            fn();
          }}
        />
      ) : null}

      {usageWarn ? (
        <ConfirmDialog
          title="This subject is in use"
          body={usageWarn.message}
          confirmLabel="Deactivate instead"
          onCancel={() => setUsageWarn(null)}
          onConfirm={() => {
            const ids = usageWarn.ids;
            setUsageWarn(null);
            const targets = rows.filter((r) => ids.includes(r.id));
            void patchStatus(targets, false);
          }}
        />
      ) : null}
    </div>
  );
}

function AssignModal({
  subjects,
  grades,
  onClose,
  onSaved,
  onError,
}: {
  subjects: SchoolSisSubject[];
  grades: GradeOpt[];
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string | null) => void;
}) {
  const initial = new Set(subjects.length === 1 ? (subjects[0].classIds ?? []) : []);
  const [checked, setChecked] = useState<Set<string>>(initial);
  const [q, setQ] = useState('');
  const [pending, setPending] = useState(false);
  const visible = grades.filter((g) => g.name.toLowerCase().includes(q.trim().toLowerCase()));
  const title =
    subjects.length === 1 ? `Assign ${subjects[0].name}` : `Assign ${subjects.length} subjects`;

  const save = async () => {
    setPending(true);
    onError(null);
    try {
      const ids = [...checked];
      for (const subject of subjects) {
        await assignSchoolSisSubjectGrades(subject.id, ids);
      }
      onSaved();
    } catch (err) {
      onError(apiErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-slate-500">Select classes for the current academic year.</p>
      <label className="relative mt-3 block">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm"
          placeholder="Search classes"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search classes"
        />
      </label>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="text-xs font-semibold text-[color:var(--school-erp-primary,#1e3a8a)]"
          onClick={() => setChecked(new Set(visible.map((g) => g.id)))}
        >
          Select All
        </button>
        <button
          type="button"
          className="text-xs font-semibold text-slate-500"
          onClick={() => setChecked(new Set())}
        >
          Clear All
        </button>
      </div>
      <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
        {visible.map((g) => (
          <label
            key={g.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={checked.has(g.id)}
              onChange={() => {
                setChecked((prev) => {
                  const next = new Set(prev);
                  if (next.has(g.id)) next.delete(g.id);
                  else next.add(g.id);
                  return next;
                });
              }}
            />
            <span className="text-sm">{g.name}</span>
          </label>
        ))}
        {!visible.length ? (
          <p className="px-2 py-6 text-center text-sm text-slate-500">
            No classes match that search.
          </p>
        ) : null}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          className="h-10 rounded-xl border border-slate-200 px-4 text-sm"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          className="h-10 rounded-xl bg-[var(--school-erp-primary,#1e3a8a)] px-4 text-sm font-semibold text-white disabled:opacity-60"
          onClick={() => void save()}
        >
          {pending ? 'Saving…' : 'Save Assignment'}
        </button>
      </div>
    </Modal>
  );
}

function ChangeTypeModal({
  subjects,
  types,
  onClose,
  onSaved,
  onError,
}: {
  subjects: SchoolSisSubject[];
  types: SchoolSisSubjectType[];
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string | null) => void;
}) {
  const [typeId, setTypeId] = useState(types[0]?.id ?? '');
  const [pending, setPending] = useState(false);
  return (
    <Modal title="Change subject type" onClose={onClose}>
      <p className="text-sm text-slate-500">
        Apply a new type to {subjects.length} selected subject{subjects.length === 1 ? '' : 's'}.
        Class assignments are not changed.
      </p>
      <select
        className={`${inputClass()} mt-3`}
        value={typeId}
        onChange={(e) => setTypeId(e.target.value)}
      >
        {types.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="h-10 rounded-xl border px-4 text-sm" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          disabled={!typeId || pending}
          className="h-10 rounded-xl bg-[var(--school-erp-primary,#1e3a8a)] px-4 text-sm font-semibold text-white"
          onClick={async () => {
            setPending(true);
            onError(null);
            try {
              const optional = types.find((t) => t.id === typeId)?.code === 'OPTIONAL';
              for (const row of subjects) {
                await updateSchoolSisSubject(row.id, {
                  name: row.name,
                  subjectTypeId: typeId,
                  isOptional: optional,
                });
              }
              onSaved();
            } catch (err) {
              onError(apiErrorMessage(err));
            } finally {
              setPending(false);
            }
          }}
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

function DetailsDrawer({
  row,
  canManage,
  onClose,
  onEdit,
  onAssign,
}: {
  row: SchoolSisSubject;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAssign: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/30"
        aria-label="Close details"
        onClick={onClose}
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <SubjectGlyph name={row.name} />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{row.name}</h2>
              <p className="text-xs text-slate-500">{row.code}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
          <Detail label="Subject Type" value={row.subjectType?.name ?? '—'} />
          <Detail
            label="Theory Marks"
            value={row.hasTheory !== false ? String(row.maxMarks ?? '—') : 'Not offered'}
          />
          <Detail label="Practical Marks" value={row.hasPractical ? 'Offered' : 'Not offered'} />
          <Detail label="Pass Marks" value={String(row.passMarks ?? '—')} />
          <Detail
            label="Assigned Classes"
            value={row.classNames?.length ? row.classNames.join(', ') : 'None'}
          />
          <Detail
            label="Assigned Teachers"
            value={row.teacherNames?.length ? row.teacherNames.join(', ') : 'None yet'}
          />
          <Detail label="Status" value={row.active === false ? 'Inactive' : 'Active'} />
          <Detail label="Created Date" value={fmtDate(row.createdAt)} />
          <Detail label="Last Updated" value={fmtDate(row.updatedAt)} />
        </div>
        {canManage ? (
          <div className="flex gap-2 border-t border-slate-100 px-5 py-3">
            <button
              type="button"
              className="h-10 flex-1 rounded-xl border border-slate-200 text-sm font-medium"
              onClick={onEdit}
            >
              Edit Subject
            </button>
            <button
              type="button"
              className="h-10 flex-1 rounded-xl bg-[var(--school-erp-primary,#1e3a8a)] text-sm font-semibold text-white"
              onClick={onAssign}
            >
              Assign Classes
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function TypesPanel({
  rows,
  canManage,
  onError,
  onDone,
}: {
  rows: SchoolSisSubjectType[];
  canManage: boolean;
  onError: (msg: string | null) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<SchoolSisSubjectType | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      if (editing)
        return updateSchoolSisSubjectType(editing.id, { name: name.trim() || editing.name });
      return createSchoolSisSubjectType({ name: name.trim() });
    },
    onSuccess: () => {
      onError(null);
      setErr(null);
      setName('');
      setEditing(null);
      onDone();
    },
    onError: (e) => {
      const msg = apiErrorMessage(e);
      setErr(msg);
      onError(msg);
    },
  });
  return (
    <div className="space-y-4">
      {canManage ? (
        <form
          className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() && !editing) {
              setErr('Subject type name is required.');
              return;
            }
            save.mutate();
          }}
        >
          <label className="text-sm">
            <span className="text-slate-500">{editing ? 'Rename type' : 'New subject type'}</span>
            <input
              className="mt-1 block h-10 w-64 rounded-xl border border-slate-200 px-3"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Optional Subject"
            />
            {err ? <span className="mt-1 block text-xs text-rose-600">{err}</span> : null}
          </label>
          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex h-10 items-center gap-1 rounded-xl bg-[var(--school-erp-primary,#1e3a8a)] px-3 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            {editing ? 'Save' : 'Add Type'}
          </button>
          {editing ? (
            <button
              type="button"
              className="h-10 text-sm text-slate-500"
              onClick={() => {
                setEditing(null);
                setName('');
                setErr(null);
              }}
            >
              Cancel
            </button>
          ) : null}
        </form>
      ) : null}
      {!rows.length ? (
        <EmptyBlock
          title="No subject types yet"
          hint="Add Main, Language, Elective and other types used by the school."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Subject type</th>
                <th className="px-4 py-3">Code</th>
                {canManage ? <th className="px-4 py-3">Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.code}</td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <IconAction
                        label="Edit"
                        onClick={() => {
                          setEditing(row);
                          setName(row.name);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </IconAction>
                      <IconAction
                        label="Delete"
                        danger
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Remove ${row.name}? Subjects using this type must be moved first.`,
                            )
                          )
                            return;
                          void deleteSchoolSisSubjectType(row.id)
                            .then(() => {
                              onError(null);
                              onDone();
                            })
                            .catch((e) => onError(apiErrorMessage(e)));
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconAction>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ClasswisePanel({
  grades,
  subjects,
  mappings,
  canManage,
  onError,
  onSaved,
}: {
  grades: GradeOpt[];
  subjects: SchoolSisSubject[];
  mappings: Array<{ gradeId: string; subjectId: string }>;
  canManage: boolean;
  onError: (msg: string | null) => void;
  onSaved: () => void;
}) {
  const [gradeId, setGradeId] = useState(grades[0]?.id ?? '');
  const selected = useMemo(
    () => new Set(mappings.filter((m) => m.gradeId === gradeId).map((m) => m.subjectId)),
    [mappings, gradeId],
  );
  const [checked, setChecked] = useState<Set<string>>(selected);
  useEffect(() => {
    setChecked(new Set(selected));
  }, [selected, gradeId]);
  useEffect(() => {
    if (!gradeId && grades[0]?.id) setGradeId(grades[0].id);
  }, [grades, gradeId]);
  const grouped = useMemo(() => {
    const map = new Map<string, SchoolSisSubject[]>();
    for (const subject of subjects.filter((s) => s.active !== false)) {
      const key = subject.subjectType?.name || 'Subjects';
      const list = map.get(key) ?? [];
      list.push(subject);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [subjects]);
  const save = useMutation({
    mutationFn: () => saveSchoolSisClassSubjects({ gradeId, subjectIds: [...checked] }),
    onSuccess: () => {
      onError(null);
      onSaved();
    },
    onError: (err) => onError(apiErrorMessage(err)),
  });
  const gradeName = grades.find((g) => g.id === gradeId)?.name ?? 'Class';
  if (!grades.length) {
    return (
      <EmptyBlock
        title="No classes yet"
        hint="Add classes under Academic Configuration before mapping subjects."
      />
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-sm">
          <span className="text-slate-500">Class</span>
          <select
            className="mt-1 block h-10 rounded-xl border border-slate-200 px-3"
            value={gradeId}
            onChange={(e) => setGradeId(e.target.value)}
          >
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-slate-500">
          {checked.size} subject{checked.size === 1 ? '' : 's'} selected for {gradeName}
        </p>
        {canManage ? (
          <button
            type="button"
            disabled={!gradeId || save.isPending}
            onClick={() => save.mutate()}
            className="h-10 rounded-xl bg-[var(--school-erp-primary,#1e3a8a)] px-3 text-sm font-semibold text-white"
          >
            {save.isPending ? 'Saving…' : 'Save mapping'}
          </button>
        ) : null}
      </div>
      {!subjects.length ? (
        <EmptyBlock
          title="No subjects in the catalogue"
          hint="Add subjects first, then map them to each class."
        />
      ) : (
        grouped.map(([typeName, list]) => (
          <div key={typeName} className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold" style={{ color: PRIMARY }}>
              {typeName}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((subject) => {
                const on = checked.has(subject.id);
                return (
                  <label
                    key={subject.id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      disabled={!canManage}
                      checked={on}
                      onChange={() => {
                        setChecked((prev) => {
                          const next = new Set(prev);
                          if (next.has(subject.id)) next.delete(subject.id);
                          else next.add(subject.id);
                          return next;
                        });
                      }}
                    />
                    <span>{subject.name}</span>
                    <span className="text-xs text-slate-400">{subject.code}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-[8rem] flex-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 rounded-full transition',
          checked ? 'bg-[var(--school-erp-primary,#1e3a8a)]' : 'bg-slate-200',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition',
            checked ? 'left-5' : 'left-0.5',
          )}
        />
      </button>
      <span className="text-sm text-slate-600">{label}</span>
    </div>
  );
}

function SubjectGlyph({ name }: { name: string }) {
  const n = name.toLowerCase();
  let cls = 'bg-indigo-50 text-indigo-700';
  if (n.includes('english') || n.includes('language')) cls = 'bg-sky-50 text-sky-700';
  else if (n.includes('math')) cls = 'bg-violet-50 text-violet-700';
  else if (
    n.includes('science') ||
    n.includes('physics') ||
    n.includes('chem') ||
    n.includes('bio')
  )
    cls = 'bg-emerald-50 text-emerald-700';
  else if (n.includes('social') || n.includes('history') || n.includes('geo'))
    cls = 'bg-amber-50 text-amber-700';
  else if (n.includes('computer') || n.includes('it')) cls = 'bg-cyan-50 text-cyan-700';
  else if (n.includes('physical') || n.includes('sport') || n.includes('pe'))
    cls = 'bg-lime-50 text-lime-700';
  return (
    <span
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
        cls,
      )}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function TypeChip({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      {label}
    </span>
  );
}

function StatusChip({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
        active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
      )}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function YesDot({ blue }: { blue?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 w-5 items-center justify-center rounded-full text-white',
        blue ? 'bg-sky-500' : 'bg-emerald-500',
      )}
    >
      <Check className="h-3 w-3" />
    </span>
  );
}

function NoDot() {
  return <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-200" />;
}

function IconAction({
  label,
  onClick,
  children,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100',
        danger && 'hover:bg-rose-50 hover:text-rose-600',
      )}
    >
      {children}
    </button>
  );
}

function BulkBtn({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1 text-xs font-semibold',
        danger ? 'bg-rose-50 text-rose-700' : 'bg-white text-slate-600 ring-1 ring-slate-200',
      )}
    >
      {children}
    </button>
  );
}

function EmptyBlock({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
      <p className="font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
      {action}
    </div>
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

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-slate-600">{body}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          className="h-10 rounded-xl border border-slate-200 px-4 text-sm"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className={cn(
            'h-10 rounded-xl px-4 text-sm font-semibold text-white',
            danger ? 'bg-rose-600' : 'bg-[var(--school-erp-primary,#1e3a8a)]',
          )}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-slate-800">{value}</p>
    </div>
  );
}

function fmtDate(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function inputClass(error?: string) {
  return cn(
    'h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[color:var(--school-erp-primary,#1e3a8a)]',
    error ? 'border-rose-300' : 'border-slate-200',
  );
}

const filterClass = 'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600';
