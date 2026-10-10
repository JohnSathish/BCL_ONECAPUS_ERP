'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Eye,
  FileText,
  GraduationCap,
  Hash,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  SlidersHorizontal,
  Table2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { Input } from '@/components/ui/input';
import { fetchAcademicStreams, fetchShifts } from '@/services/academic-engine';
import {
  buildDefaultCategoryPolicy,
  createIaExam,
  downloadIaNoticeboardRoutinePdf,
  fetchIaExamDepartments,
  fetchIaExams,
  IA_SUBJECT_CATEGORY_OPTIONS,
  previewIaExam,
  updateIaExam,
  type CreateIaExamPayload,
  type IaExamSummary,
  type UpdateIaExamPayload,
} from '@/services/examinations-ia';
import { fetchAcademicYears } from '@/services/organization';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const EXAM_TYPE_OPTIONS = [
  ['IA_TEST_1', 'IA Test 1'],
  ['IA_TEST_2', 'IA Test 2'],
  ['IA_TEST_3', 'IA Test 3'],
  ['IA_ASSIGNMENT', 'Assignment'],
  ['IA_SEMINAR', 'Seminar'],
  ['IA_PRESENTATION', 'Presentation'],
  ['IA_PROJECT_WORK', 'Project Work'],
  ['IA_PRACTICAL', 'Practical Assessment'],
  ['IA_VIVA', 'Viva'],
  ['IA_CIE', 'Continuous Internal Evaluation'],
] as const;

const STATUS_OPTIONS = [
  'DRAFT',
  'SCHEDULED',
  'ACTIVE',
  'IN_PROGRESS',
  'OPEN',
  'COMPLETED',
  'EXPIRED',
  'CANCELLED',
] as const;

const ODD_SEMESTERS = [1, 3, 5, 7];
const EVEN_SEMESTERS = [2, 4, 6, 8];
const PAGE_SIZE = 8;
const fieldClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

function isoDate(value?: string | null) {
  if (!value) return '';
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : '';
}

function typeLabel(examType: string) {
  return examType.replaceAll('_', ' ');
}

function statusClass(status: string) {
  if (status === 'SCHEDULED' || status === 'OPEN') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }
  if (status === 'EXPIRED' || status === 'CANCELLED') {
    return 'bg-rose-50 text-rose-600 ring-rose-200';
  }
  if (status === 'COMPLETED') return 'bg-sky-50 text-sky-700 ring-sky-200';
  if (status === 'ACTIVE' || status === 'IN_PROGRESS') {
    return 'bg-amber-50 text-amber-700 ring-amber-200';
  }
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

function shiftClass(name: string) {
  const value = name.toLowerCase();
  if (value.includes('morning')) return 'bg-violet-50 text-violet-700';
  if (value.includes('day')) return 'bg-sky-50 text-sky-700';
  return 'bg-slate-100 text-slate-600';
}

function Field({
  label,
  required,
  icon,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-[13px] font-medium text-slate-700">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </span>
      <span className="relative block">
        {icon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        ) : null}
        {children}
      </span>
    </label>
  );
}

export function IaExamsWorkspace() {
  const qc = useQueryClient();
  const wizardRef = useRef<HTMLElement>(null);
  const [message, setMessage] = useState('');
  const [step, setStep] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<IaExamSummary | null>(null);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [page, setPage] = useState(1);

  const [name, setName] = useState('IA Test 1');
  const [examType, setExamType] = useState('IA_TEST_1');
  const [maxMarks, setMaxMarks] = useState(20);
  const [remarks, setRemarks] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [semesterNos, setSemesterNos] = useState<number[]>([1, 3, 5]);
  const [categoryPolicy, setCategoryPolicy] = useState<Record<string, string[]>>(() =>
    buildDefaultCategoryPolicy([1, 3, 5]),
  );
  const [streamId, setStreamId] = useState('');
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [allDepartments, setAllDepartments] = useState(true);

  const years = useQuery({ queryKey: ['academic-years'], queryFn: fetchAcademicYears });
  const streams = useQuery({ queryKey: ['academic-streams'], queryFn: fetchAcademicStreams });
  const shifts = useQuery({ queryKey: ['academic-shifts'], queryFn: fetchShifts });
  const departments = useQuery({
    queryKey: ['ia', 'exam-departments', streamId || 'all'],
    queryFn: () => fetchIaExamDepartments(streamId || undefined),
  });
  const exams = useQuery({ queryKey: ['ia', 'exams'], queryFn: fetchIaExams });

  const activeYear = useMemo(
    () => years.data?.find((y) => y.status === 'ACTIVE') ?? years.data?.[0],
    [years.data],
  );

  useEffect(() => {
    if (!academicYearId && activeYear?.id && !editingId) setAcademicYearId(activeYear.id);
  }, [academicYearId, activeYear?.id, editingId]);

  useEffect(() => {
    if (allDepartments) setDepartmentIds([]);
  }, [allDepartments, streamId]);

  useEffect(() => {
    setCategoryPolicy((prev) => {
      const next = { ...prev };
      for (const sem of semesterNos) {
        const key = String(sem);
        if (!next[key]?.length) next[key] = buildDefaultCategoryPolicy([sem])[key];
      }
      for (const key of Object.keys(next)) {
        if (!semesterNos.includes(Number(key))) delete next[key];
      }
      return next;
    });
  }, [semesterNos]);

  const payload = useMemo<CreateIaExamPayload>(
    () => ({
      name: name.trim(),
      semesterNos,
      streamId: streamId || undefined,
      departmentIds: allDepartments ? undefined : departmentIds,
      academicYearId: academicYearId || activeYear?.id,
      shiftId: shiftId || undefined,
      examType,
      maxMarks,
      remarks: remarks || undefined,
      enabledCategoriesBySemester: categoryPolicy,
    }),
    [
      name,
      semesterNos,
      streamId,
      allDepartments,
      departmentIds,
      academicYearId,
      activeYear?.id,
      shiftId,
      examType,
      maxMarks,
      remarks,
      categoryPolicy,
    ],
  );

  const preview = useQuery({
    queryKey: ['ia', 'exam-preview', payload],
    queryFn: () => previewIaExam(payload),
    enabled: !editingId && step === 2 && semesterNos.length > 0 && Boolean(name.trim()),
  });

  const create = useMutation({
    mutationFn: () => createIaExam(payload),
    onSuccess: (result) => {
      setMessage(
        `Examination created. ${result.summary.studentsRegistered} students registered across ${result.summary.subjectsLoaded} subjects.`,
      );
      resetForm();
      qc.invalidateQueries({ queryKey: ['ia'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not create IA examination')),
  });

  const saveEdit = useMutation({
    mutationFn: (body: UpdateIaExamPayload) => updateIaExam(editingId!, body),
    onSuccess: () => {
      setMessage('Examination updated.');
      resetForm();
      setViewing(null);
      qc.invalidateQueries({ queryKey: ['ia'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not update IA examination')),
  });

  const quickStatus = useMutation({
    mutationFn: (input: { id: string; status: string }) =>
      updateIaExam(input.id, { status: input.status }),
    onSuccess: () => {
      setMessage('Examination status updated.');
      qc.invalidateQueries({ queryKey: ['ia'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not update the status')),
  });

  function resetForm() {
    setEditingId(null);
    setStep(0);
    setName('IA Test 1');
    setExamType('IA_TEST_1');
    setMaxMarks(20);
    setRemarks('');
    setShiftId('');
    setAcademicYearId(activeYear?.id ?? '');
    setStatus('DRAFT');
    setStartDate('');
    setEndDate('');
    setSemesterNos([1, 3, 5]);
    setCategoryPolicy(buildDefaultCategoryPolicy([1, 3, 5]));
    setStreamId('');
    setDepartmentIds([]);
    setAllDepartments(true);
  }

  function beginCreate() {
    resetForm();
    wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function beginEdit(exam: IaExamSummary) {
    setEditingId(exam.id);
    setName(exam.name);
    setExamType(exam.examType);
    setMaxMarks(exam.stats?.maxMarks ?? exam.metadata?.maxMarks ?? 20);
    setRemarks(exam.instructions ?? '');
    setShiftId(exam.shiftId ?? '');
    setAcademicYearId(exam.academicYearId ?? '');
    setStatus(exam.status);
    setStartDate(isoDate(exam.startDate));
    setEndDate(isoDate(exam.endDate));
    setSemesterNos(exam.stats?.semesterNos ?? (exam.semesterNo ? [exam.semesterNo] : []));
    setStep(0);
    setViewing(null);
    wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function downloadNotice(exam: IaExamSummary) {
    try {
      const { blob, filename } = await downloadIaNoticeboardRoutinePdf(exam.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMessage(apiErrorMessage(e, 'Could not download the notice'));
    }
  }

  const toggleSemester = (sem: number, on: boolean) => {
    setSemesterNos((prev) => {
      const next = new Set(prev);
      if (on) next.add(sem);
      else next.delete(sem);
      return [...next].sort((a, b) => a - b);
    });
  };

  const toggleCategory = (sem: number, category: string, on: boolean) => {
    const key = String(sem);
    setCategoryPolicy((prev) => {
      const current = new Set(prev[key] ?? []);
      if (on) current.add(category);
      else current.delete(category);
      return { ...prev, [key]: [...current] };
    });
  };

  const categoriesValid = semesterNos.every(
    (sem) => (categoryPolicy[String(sem)]?.length ?? 0) > 0,
  );
  const canNext = () => {
    if (step === 0) return Boolean(name.trim()) && maxMarks > 0;
    if (step === 1 && !editingId) {
      return (
        semesterNos.length > 0 && categoriesValid && (allDepartments || departmentIds.length > 0)
      );
    }
    return true;
  };

  const selectedStreamName =
    streamId === ''
      ? 'All Streams'
      : (streams.data?.find((s) => s.id === streamId)?.name ?? 'Selected stream');
  const selectedShiftName =
    shiftId === ''
      ? 'All shifts'
      : (shifts.data?.find((s) => s.id === shiftId)?.name ?? 'Selected shift');
  const selectedYearName =
    years.data?.find((y) => y.id === academicYearId)?.name ?? activeYear?.name ?? '—';

  const rows = exams.data ?? [];
  const counts = {
    total: rows.length,
    scheduled: rows.filter((e) => e.status === 'SCHEDULED' || e.status === 'OPEN').length,
    progress: rows.filter((e) => e.status === 'ACTIVE' || e.status === 'IN_PROGRESS').length,
    completed: rows.filter((e) => e.status === 'COMPLETED').length,
    expired: rows.filter((e) => e.status === 'EXPIRED' || e.status === 'CANCELLED').length,
  };

  const filtered = rows.filter((exam) => {
    const yearName = exam.stats?.academicYearName ?? '';
    const yearId = exam.academicYearId ?? '';
    if (search && !exam.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (yearFilter !== 'all' && yearId !== yearFilter && yearName !== yearFilter) return false;
    if (statusFilter !== 'all' && exam.status !== statusFilter) return false;
    if (typeFilter !== 'all' && exam.examType !== typeFilter) return false;
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const statCards = [
    {
      label: 'Total Examinations',
      hint: 'All examinations',
      value: counts.total,
      icon: ClipboardList,
      wrap: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Scheduled',
      hint: 'Upcoming examinations',
      value: counts.scheduled,
      icon: CalendarDays,
      wrap: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'In Progress',
      hint: 'Live examinations',
      value: counts.progress,
      icon: PlayCircle,
      wrap: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Completed',
      hint: 'Finished examinations',
      value: counts.completed,
      icon: CheckCircle2,
      wrap: 'bg-sky-50 text-sky-600',
    },
    {
      label: 'Expired',
      hint: 'Past examinations',
      value: counts.expired,
      icon: Clock3,
      wrap: 'bg-rose-50 text-rose-500',
    },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              IA Examination Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Create examinations, configure schedules and track assessment progress.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <p className="text-xs text-slate-400">
            Dashboard <span className="px-1">›</span> Examination <span className="px-1">›</span>
            <span className="font-medium text-slate-600">IA Examinations</span>
          </p>
          <Button
            type="button"
            className="rounded-xl bg-blue-600 px-4 hover:bg-blue-700"
            onClick={beginCreate}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Create Examination
          </Button>
        </div>
      </header>

      {exams.isError ? (
        <QueryErrorPanel
          title="Unable to load IA examinations"
          error={exams.error}
          onRetry={() => void exams.refetch()}
          isRetrying={exams.isFetching}
        />
      ) : null}
      {message ? (
        <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          {message}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.label}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <span
                className={cn('flex h-11 w-11 items-center justify-center rounded-xl', card.wrap)}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-slate-500">{card.label}</p>
                <p className="text-2xl font-bold leading-none text-slate-900">{card.value}</p>
                <p className="mt-1 text-[11px] text-slate-400">{card.hint}</p>
              </div>
            </article>
          );
        })}
      </section>

      <section
        ref={wizardRef}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="flex items-center justify-between bg-blue-600 px-5 py-3 text-white">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Pencil className="h-4 w-4" />
            {editingId ? 'Edit IA Examination' : 'Create New IA Examination'}
          </h2>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
            Step {step + 1} of 3
          </span>
        </div>
        <div className="border-b border-slate-100 px-5 py-4">
          <ol className="grid gap-3 md:grid-cols-3">
            {[
              ['Basic Details', 'Exam name, type and settings'],
              ['Academic Configuration', 'Semesters, departments, shift'],
              ['Review & Create', editingId ? 'Confirm and save' : 'Confirm and save'],
            ].map(([title, hint], index) => (
              <li key={title} className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                    index === step
                      ? 'bg-blue-600 text-white'
                      : index < step
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-400',
                  )}
                >
                  {index + 1}
                </span>
                <span>
                  <span
                    className={cn(
                      'block text-sm font-semibold',
                      index === step ? 'text-slate-900' : 'text-slate-500',
                    )}
                  >
                    {title}
                  </span>
                  <span className="block text-xs text-slate-400">{hint}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="px-5 py-5">
          {step === 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Exam Name" required className="md:col-span-1">
                <Input
                  className={fieldClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Academic Year" required icon={<CalendarDays className="h-4 w-4" />}>
                <select
                  className={cn(fieldClass, 'pl-10')}
                  value={academicYearId}
                  onChange={(e) => setAcademicYearId(e.target.value)}
                >
                  {(years.data ?? []).map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Exam Type" required icon={<ClipboardList className="h-4 w-4" />}>
                <select
                  className={cn(fieldClass, 'pl-10')}
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                >
                  {EXAM_TYPE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Maximum Marks" required icon={<Hash className="h-4 w-4" />}>
                <Input
                  className={cn(fieldClass, 'pl-10')}
                  type="number"
                  min={1}
                  max={100}
                  value={maxMarks}
                  onChange={(e) => setMaxMarks(Number(e.target.value) || 1)}
                />
              </Field>
              <Field label="Shift" required icon={<Clock3 className="h-4 w-4" />}>
                <select
                  className={cn(fieldClass, 'pl-10')}
                  value={shiftId}
                  onChange={(e) => setShiftId(e.target.value)}
                >
                  <option value="">All shifts</option>
                  {(shifts.data ?? []).map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Remarks (Optional)" icon={<FileText className="h-4 w-4" />}>
                <Input
                  className={cn(fieldClass, 'pl-10')}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Instructions for exam cell"
                />
              </Field>
              {editingId ? (
                <>
                  <Field label="Status">
                    <select
                      className={fieldClass}
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      {STATUS_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Start date">
                      <Input
                        className={fieldClass}
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </Field>
                    <Field label="End date">
                      <Input
                        className={fieldClass}
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </Field>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500 md:col-span-2">
                  For First Internal Assessment, create two exams — one Morning and one Day — so
                  each shift gets its own timetable.
                </p>
              )}
            </div>
          ) : null}

          {step === 1 && editingId ? (
            <div className="space-y-3 text-sm text-slate-600">
              <p>
                Semesters stay as they were created:{' '}
                <span className="font-semibold text-slate-900">
                  {semesterNos.join(', ') || '—'}
                </span>
                . Subjects and registered students are kept. Save updates the name, marks, shift,
                dates, and status.
              </p>
              <p>
                Shift: <span className="font-semibold text-slate-900">{selectedShiftName}</span>
              </p>
            </div>
          ) : null}

          {step === 1 && !editingId ? (
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-800">Semesters</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSemesterNos([...ODD_SEMESTERS])}
                  >
                    Odd (1,3,5,7)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSemesterNos([...EVEN_SEMESTERS])}
                  >
                    Even (2,4,6,8)
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                    <label
                      key={sem}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={semesterNos.includes(sem)}
                        onChange={(e) => toggleSemester(sem, e.target.checked)}
                      />
                      Semester {sem}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-800">Subject categories</p>
                {semesterNos.map((sem) => {
                  const enabled = new Set(categoryPolicy[String(sem)] ?? []);
                  return (
                    <div key={sem} className="rounded-xl border border-slate-200 p-3">
                      <p className="mb-2 text-sm font-medium">Semester {sem}</p>
                      <div className="flex flex-wrap gap-2">
                        {IA_SUBJECT_CATEGORY_OPTIONS.map((cat) => (
                          <label
                            key={cat}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={enabled.has(cat)}
                              onChange={(e) => toggleCategory(sem, cat, e.target.checked)}
                            />
                            {cat}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Stream">
                  <select
                    className={fieldClass}
                    value={streamId}
                    onChange={(e) => setStreamId(e.target.value)}
                  >
                    <option value="">All Streams</option>
                    {(streams.data ?? []).map((stream) => (
                      <option key={stream.id} value={stream.id}>
                        {stream.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <label className="mt-7 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={allDepartments}
                    onChange={(e) => setAllDepartments(e.target.checked)}
                  />
                  All departments{streamId ? ` in ${selectedStreamName}` : ''}
                </label>
              </div>
              {!allDepartments ? (
                <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2 md:grid-cols-3">
                  {(departments.data ?? []).map((dept) => (
                    <label
                      key={dept.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={departmentIds.includes(dept.id)}
                        onChange={(e) => {
                          setAllDepartments(false);
                          setDepartmentIds((prev) =>
                            e.target.checked
                              ? [...prev, dept.id]
                              : prev.filter((id) => id !== dept.id),
                          );
                        }}
                      />
                      {dept.name}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <dl className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-2">
              <div>
                <dt className="text-slate-500">Exam name</dt>
                <dd className="font-semibold text-slate-900">{preview.data?.examName ?? name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Academic year</dt>
                <dd className="font-semibold">{preview.data?.academicYear ?? selectedYearName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Type</dt>
                <dd className="font-semibold">{typeLabel(examType)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Maximum marks</dt>
                <dd className="font-semibold">{preview.data?.maxMarks ?? maxMarks}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Shift</dt>
                <dd className="font-semibold">{preview.data?.shiftName ?? selectedShiftName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Semesters</dt>
                <dd className="font-semibold">
                  {(preview.data?.semesters ?? semesterNos).join(', ') || '—'}
                </dd>
              </div>
              {!editingId ? (
                <>
                  <div>
                    <dt className="text-slate-500">Students</dt>
                    <dd className="font-semibold">
                      {preview.data ? preview.data.students.toLocaleString() : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Subjects</dt>
                    <dd className="font-semibold">{preview.data?.subjects ?? '—'}</dd>
                  </div>
                </>
              ) : (
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd className="font-semibold">{status.replaceAll('_', ' ')}</dd>
                </div>
              )}
            </dl>
          ) : null}
          {step === 2 && preview.isError && !editingId ? (
            <p className="mt-3 text-sm text-rose-600">
              {apiErrorMessage(preview.error, 'Preview failed.')}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          <Button type="button" variant="outline" className="rounded-xl" onClick={resetForm}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setStep((s) => s - 1)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            ) : null}
            {step < 2 ? (
              <Button
                type="button"
                className="rounded-xl bg-blue-600 hover:bg-blue-700"
                disabled={!canNext()}
                onClick={() => setStep((s) => s + 1)}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                className="rounded-xl bg-blue-600 hover:bg-blue-700"
                disabled={
                  create.isPending ||
                  saveEdit.isPending ||
                  (!editingId &&
                    (preview.isLoading || (preview.data != null && !preview.data.ready)))
                }
                onClick={() => {
                  if (editingId) {
                    saveEdit.mutate({
                      name: name.trim(),
                      examType,
                      academicYearId: academicYearId || undefined,
                      shiftId: shiftId || null,
                      maxMarks,
                      remarks,
                      status,
                      startDate: startDate || null,
                      endDate: endDate || null,
                    });
                    return;
                  }
                  create.mutate();
                }}
              >
                {editingId
                  ? saveEdit.isPending
                    ? 'Saving…'
                    : 'Save changes'
                  : create.isPending
                    ? 'Creating…'
                    : 'Create Examination'}
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="border-b-2 border-rose-500 pb-1 text-base font-bold text-slate-900">
            IA Examinations
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search examinations..."
                className="h-10 w-56 rounded-xl pl-9"
              />
            </span>
            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Academic Year: All</option>
              {(years.data ?? []).map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
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
              <option value="all">Status: All</option>
              {STATUS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <SlidersHorizontal className="mr-1.5 h-4 w-4" />
              Filters
            </Button>
            <div className="flex rounded-xl border border-slate-200 p-0.5">
              <button
                type="button"
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold',
                  viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-slate-500',
                )}
                onClick={() => setViewMode('table')}
              >
                <Table2 className="mr-1 inline h-3.5 w-3.5" />
                Table
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold',
                  viewMode === 'cards' ? 'bg-blue-600 text-white' : 'text-slate-500',
                )}
                onClick={() => setViewMode('cards')}
              >
                <LayoutGrid className="mr-1 inline h-3.5 w-3.5" />
                Cards
              </button>
            </div>
          </div>
        </div>
        {filtersOpen ? (
          <div className="border-b border-slate-100 px-5 py-3">
            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Exam type: All</option>
              {EXAM_TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  {[
                    '#',
                    'Examination name',
                    'Type',
                    'Academic year',
                    'Shift',
                    'Semesters',
                    'Departments',
                    'Registered',
                    'Subjects',
                    'Marks entered',
                    'Completion',
                    'Status',
                    'Actions',
                  ].map((heading) => (
                    <th key={heading} className="px-3 py-3 font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((exam, index) => (
                  <ExamRow
                    key={exam.id}
                    exam={exam}
                    index={(safePage - 1) * PAGE_SIZE + index + 1}
                    yearName={years.data?.find((y) => y.id === exam.academicYearId)?.name}
                    onView={() => setViewing(exam)}
                    onEdit={() => beginEdit(exam)}
                    onNotice={() => void downloadNotice(exam)}
                    onStatus={(next) => quickStatus.mutate({ id: exam.id, status: next })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {pageRows.map((exam) => (
              <article key={exam.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{exam.name}</h3>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold ring-1',
                      statusClass(exam.status),
                    )}
                  >
                    {exam.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {typeLabel(exam.examType)} · {exam.stats?.shiftName || 'All shifts'}
                </p>
                <ExamActions
                  exam={exam}
                  onView={() => setViewing(exam)}
                  onEdit={() => beginEdit(exam)}
                  onNotice={() => void downloadNotice(exam)}
                  onStatus={(next) => quickStatus.mutate({ id: exam.id, status: next })}
                />
              </article>
            ))}
          </div>
        )}

        {!filtered.length && !exams.isLoading ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No examinations match these filters.
          </p>
        ) : null}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          <span>
            Showing {filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–
            {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
            >
              Prev
            </Button>
            <span>
              {safePage} of {pageCount}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={safePage >= pageCount}
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
          </DialogHeader>
          {viewing ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Type</dt>
                <dd className="font-medium">{typeLabel(viewing.examType)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd className="font-medium">{viewing.status}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Shift</dt>
                <dd className="font-medium">{viewing.stats?.shiftName || 'All shifts'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Semesters</dt>
                <dd className="font-medium">{viewing.stats?.semesterNos?.join(', ') || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Registered</dt>
                <dd className="font-medium">
                  {viewing.stats?.registeredStudents?.toLocaleString() ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Marks entered</dt>
                <dd className="font-medium">
                  {viewing.stats
                    ? `${viewing.stats.marksEntered.toLocaleString()} / ${viewing.stats.expectedRegistrations.toLocaleString()}`
                    : '—'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">Remarks</dt>
                <dd className="font-medium">{viewing.instructions || '—'}</dd>
              </div>
            </dl>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => viewing && beginEdit(viewing)}>
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExamRow({
  exam,
  index,
  yearName,
  onView,
  onEdit,
  onNotice,
  onStatus,
}: {
  exam: IaExamSummary;
  index: number;
  yearName?: string;
  onView: () => void;
  onEdit: () => void;
  onNotice: () => void;
  onStatus: (status: string) => void;
}) {
  const stats = exam.stats;
  const shift = stats?.shiftName || exam.metadata?.shiftName || 'All';
  const year = yearName || stats?.academicYearName || '—';
  const percent = stats?.completionPercent ?? 0;
  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-3 text-slate-500">{index}</td>
      <td className="max-w-[220px] px-3 py-3 font-semibold text-slate-900">{exam.name}</td>
      <td className="px-3 py-3">
        <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
          {typeLabel(exam.examType)}
        </span>
      </td>
      <td className="px-3 py-3 text-slate-600">{year}</td>
      <td className="px-3 py-3">
        <span className={cn('rounded-full px-2 py-1 text-[11px] font-semibold', shiftClass(shift))}>
          {shift}
        </span>
      </td>
      <td className="px-3 py-3 text-slate-600">{stats?.semesterNos?.join(', ') || '—'}</td>
      <td className="px-3 py-3 text-slate-600">
        {stats?.departmentCount ? stats.departmentCount : 'All'}
      </td>
      <td className="px-3 py-3">{stats?.registeredStudents?.toLocaleString() ?? '—'}</td>
      <td className="px-3 py-3">{stats?.subjectsScheduled ?? '—'}</td>
      <td className="px-3 py-3">
        {stats
          ? `${stats.marksEntered.toLocaleString()} / ${stats.expectedRegistrations.toLocaleString()}`
          : '—'}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
            <span className="block h-full bg-blue-600" style={{ width: `${percent}%` }} />
          </span>
          <span className="text-xs text-slate-500">{percent}%</span>
        </div>
      </td>
      <td className="px-3 py-3">
        <span
          className={cn(
            'rounded-full px-2 py-1 text-[10px] font-bold uppercase ring-1',
            statusClass(exam.status),
          )}
        >
          {exam.status}
        </span>
      </td>
      <td className="px-3 py-3">
        <ExamActions
          exam={exam}
          onView={onView}
          onEdit={onEdit}
          onNotice={onNotice}
          onStatus={onStatus}
        />
      </td>
    </tr>
  );
}

function ExamActions({
  exam,
  onView,
  onEdit,
  onNotice,
  onStatus,
}: {
  exam: IaExamSummary;
  onView: () => void;
  onEdit: () => void;
  onNotice: () => void;
  onStatus: (status: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <IconButton label="View" onClick={onView}>
        <Eye className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton label="Edit" onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton label="Download notice" onClick={onNotice}>
        <FileText className="h-3.5 w-3.5" />
      </IconButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
            aria-label="More"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/academics/examinations/timetable?exam=${exam.id}`}>
              Open timetable
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/admin/academics/examinations/mark-entry">Open mark entry</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onStatus('SCHEDULED')}>Mark scheduled</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onStatus('COMPLETED')}>Mark completed</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onStatus('EXPIRED')}>Mark expired</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
