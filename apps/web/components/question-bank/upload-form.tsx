'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  CloudUpload,
  FileText,
  FileUp,
  Globe,
  Info,
  Layers,
  Loader2,
  RotateCcw,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { QuestionBankBulkImportDialog } from './bulk-import-dialog';
import { StatusBadge, formatBytes } from './qb-shared';
import { QbSearchableSelect, type QbSelectOption } from './qb-searchable-select';
import { Button } from '@/components/ui/button';
import { useAuth, useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchAcademicDepartments, fetchAcademicYears } from '@/services/organization';
import { fetchAllPrograms } from '@/services/programs';
import {
  createQuestionPaper,
  fetchCurriculumCourses,
  fetchQuestionBankSettings,
  fetchQuestionPapers,
} from '@/services/question-bank';
import type { AcademicYear } from '@/types/organization';
import type { Program } from '@/types/programs';
import type { QuestionPaper } from '@/types/question-bank';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const MAX_UPLOAD_MB = 10;
const SEMESTERS = Array.from({ length: 10 }, (_, index) => index + 1);
const EXAMINATION_TYPES: Array<{ value: string; label: string }> = [
  { value: 'UNIVERSITY_EXAM', label: 'University Exam' },
  { value: 'INTERNAL', label: 'Internal Assessment' },
  { value: 'MID_SEM', label: 'Mid Semester' },
  { value: 'MODEL', label: 'Model Exam' },
  { value: 'PRACTICAL', label: 'Practical' },
  { value: 'SUPPLEMENTARY', label: 'Supplementary' },
  { value: 'REVALUATION', label: 'Revaluation' },
];
const EXAM_LABELS = Object.fromEntries(EXAMINATION_TYPES.map((t) => [t.value, t.label]));
const SUBJECT_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'MAJOR', label: 'Major' },
  { value: 'MINOR', label: 'Minor' },
  { value: 'MDC', label: 'Multidisciplinary (MDC)' },
  { value: 'AEC', label: 'Ability Enhancement (AEC)' },
  { value: 'SEC', label: 'Skill Enhancement (SEC)' },
  { value: 'VAC', label: 'Value Added (VAC)' },
  { value: 'VTC', label: 'Vocational (VTC)' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'PROJECT', label: 'Project' },
  { value: 'RESEARCH', label: 'Research' },
  { value: 'DISSERTATION', label: 'Dissertation' },
  { value: 'ELECTIVE', label: 'Elective' },
  { value: 'OPEN_ELECTIVE', label: 'Open Elective' },
  { value: 'PRACTICAL', label: 'Practical' },
];
const CATEGORY_LABELS = Object.fromEntries(SUBJECT_CATEGORIES.map((c) => [c.value, c.label]));

function normalizeCategory(value?: string | null) {
  const upper = value?.trim().toUpperCase() ?? '';
  return CATEGORY_LABELS[upper] ? upper : '';
}

type Details = {
  academicYearId: string;
  semesterNo: string;
  examinationType: string;
  programId: string;
  departmentId: string;
  subjectCategory: string;
  courseId: string;
};

const emptyDetails = (academicYearId = ''): Details => ({
  academicYearId,
  semesterNo: '',
  examinationType: 'UNIVERSITY_EXAM',
  programId: '',
  departmentId: '',
  subjectCategory: '',
  courseId: '',
});

const fieldClass =
  'h-10 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-xs transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted/40 disabled:hover:border-border';

function currentAcademicYear(years: AcademicYear[]) {
  const now = Date.now();
  return (
    years.find(
      (y) => y.status?.toUpperCase() === 'ACTIVE' || y.status?.toUpperCase() === 'CURRENT',
    ) ??
    years.find(
      (y) => new Date(y.startDate).getTime() <= now && now <= new Date(y.endDate).getTime(),
    )
  );
}

function activeVersionId(program?: Program) {
  const versions = program?.versions ?? [];
  return (versions.find((v) => v.status === 'PUBLISHED') ?? versions[0])?.id ?? '';
}

/** Odd-semester exams sit in the first calendar year of the session, even ones in the second. */
function examYearFor(year: AcademicYear | undefined, semesterNo: number) {
  const start = year ? new Date(year.startDate).getFullYear() : NaN;
  const end = year ? new Date(year.endDate).getFullYear() : NaN;
  if (Number.isNaN(start) || Number.isNaN(end)) return new Date().getFullYear();
  return semesterNo % 2 === 1 ? start : end;
}

async function validatePdf(file: File, maxMb: number): Promise<string | null> {
  if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) {
    return 'Only PDF files are allowed. Please choose a .pdf file.';
  }
  if (file.size === 0) return 'This file is empty. Please choose another PDF.';
  if (file.size > maxMb * 1024 * 1024) {
    return `This PDF is ${formatBytes(file.size)}. The maximum allowed size is ${maxMb} MB.`;
  }
  const head = await file.slice(0, 5).text();
  if (head !== '%PDF-') return 'This file is not a valid PDF document.';
  return null;
}

function paperFromResponse(
  res: QuestionPaper | { paper: QuestionPaper; version: { versionNo: number } },
) {
  return 'paper' in res
    ? { paper: res.paper, versionNo: res.version.versionNo }
    : { paper: res, versionNo: null };
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 space-y-1.5 ${className ?? ''}`}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SectionHeading({
  id,
  step,
  title,
  description,
  done,
}: {
  id: string;
  step: number;
  title: string;
  description: string;
  done?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors',
          done
            ? 'bg-emerald-600 text-white'
            : 'bg-primary text-primary-foreground shadow-sm shadow-primary/30',
        )}
        aria-hidden
      >
        {done ? <Check className="h-4 w-4" strokeWidth={3} /> : step}
      </span>
      <div className="min-w-0 flex-1">
        <h3 id={id} className="text-base font-semibold leading-tight">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {done ? (
        <span className="hidden shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 sm:inline dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
          Complete
        </span>
      ) : null}
    </div>
  );
}

type UploadProgressState = {
  loaded: number;
  total: number;
  /** Bytes per second since the upload started. */
  speed: number;
  etaSeconds: number | null;
};

function formatEta(seconds: number) {
  if (seconds < 1) return 'less than a second left';
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.ceil(seconds % 60)}s left`;
}

function UploadProgressPanel({
  fileName,
  progress,
  percent,
  onCancel,
}: {
  fileName: string;
  progress: UploadProgressState;
  percent: number;
  onCancel: () => void;
}) {
  const finalising = percent >= 100;
  return (
    <div
      className="space-y-3 rounded-xl bg-primary/5 p-4 ring-1 ring-primary/20"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {finalising ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <CloudUpload className="h-5 w-5 animate-pulse" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={fileName}>
            {finalising ? 'Saving and publishing…' : `Uploading ${fileName}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {finalising
              ? 'File received. Almost done.'
              : [
                  `${formatBytes(progress.loaded)} of ${formatBytes(progress.total)}`,
                  progress.speed ? `${formatBytes(progress.speed)}/s` : null,
                  progress.etaSeconds != null ? formatEta(progress.etaSeconds) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </p>
        </div>
        <span className="shrink-0 text-lg font-bold tabular-nums text-primary">{percent}%</span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-primary/15"
        role="progressbar"
        aria-label="Upload progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className={cn(
            'h-full rounded-full bg-primary transition-[width] duration-200 ease-out',
            finalising && 'animate-pulse',
          )}
          style={{ width: `${Math.max(percent, 3)}%` }}
        />
      </div>
      {!finalising ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            <X className="mr-1 h-4 w-4" /> Cancel upload
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
      <span className="h-px flex-1 bg-border/60" aria-hidden />
    </p>
  );
}

type Props = {
  canManage?: boolean;
  repositoryHref?: string;
  onDone: () => void;
};

export function QuestionPaperUploadForm({ canManage, repositoryHref, onDone }: Props) {
  const queryEnabled = useAuthQueryEnabled();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [details, setDetails] = useState<Details>(emptyDetails);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [success, setSuccess] = useState<{
    label: string;
    versionNo: number | null;
    onWebsite: boolean;
  } | null>(null);
  const [toast, setToast] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [showOnWebsite, setShowOnWebsite] = useState(true);
  const [progress, setProgress] = useState<UploadProgressState | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const yearDefaulted = useRef(false);

  const yearsQuery = useQuery({
    queryKey: ['org', 'academic-years'],
    queryFn: fetchAcademicYears,
    enabled: queryEnabled,
  });
  const deptsQuery = useQuery({
    queryKey: ['org', 'academic-departments'],
    queryFn: () => fetchAcademicDepartments(),
    enabled: queryEnabled,
  });
  const programsQuery = useQuery({
    queryKey: ['programs', 'all'],
    queryFn: () => fetchAllPrograms(),
    enabled: queryEnabled,
  });
  const settingsQuery = useQuery({
    queryKey: ['question-bank', 'settings'],
    queryFn: fetchQuestionBankSettings,
    enabled: queryEnabled && Boolean(canManage),
  });

  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const programs = programsQuery.data?.data ?? [];
  const selectedYear = years.find((y) => y.id === details.academicYearId);
  const selectedProgram = programs.find((p) => p.id === details.programId);
  const programVersionId = activeVersionId(selectedProgram);
  const maxMb = Math.min(MAX_UPLOAD_MB, settingsQuery.data?.maxUploadMb ?? MAX_UPLOAD_MB);

  useEffect(() => {
    if (yearDefaulted.current || !years.length) return;
    yearDefaulted.current = true;
    const current = currentAcademicYear(years);
    if (current)
      setDetails((prev) => (prev.academicYearId ? prev : { ...prev, academicYearId: current.id }));
  }, [years]);

  const coursesQuery = useQuery({
    queryKey: [
      'question-bank',
      'curriculum',
      details.departmentId,
      programVersionId,
      details.semesterNo,
      details.subjectCategory,
    ],
    queryFn: () =>
      fetchCurriculumCourses({
        departmentId: details.departmentId || undefined,
        programVersionId: programVersionId || undefined,
        semesterNo: Number(details.semesterNo),
        category: details.subjectCategory || undefined,
      }),
    enabled: queryEnabled && Boolean(details.semesterNo),
  });
  const courses = coursesQuery.data ?? [];
  const selectedCourse = courses.find((c) => c.id === details.courseId);

  const recentQuery = useQuery({
    queryKey: ['question-bank', 'papers', 'recent-uploads', userId],
    queryFn: () => fetchQuestionPapers({ uploadedById: userId, limit: 20 }),
    enabled: queryEnabled && Boolean(userId),
  });
  const recent = useMemo(
    () =>
      [...(recentQuery.data?.items ?? [])]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
    [recentQuery.data],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const departmentOptions: QbSelectOption[] = (deptsQuery.data ?? []).map((d) => ({
    value: d.id,
    label: d.name,
    badge: d.code || undefined,
  }));
  const courseOptions: QbSelectOption[] = courses.map((c) => {
    const category = normalizeCategory(c.category);
    return {
      value: c.id,
      label: c.title,
      badge: c.code,
      hint: category ? CATEGORY_LABELS[category] : (c.category ?? undefined),
    };
  });

  const patch = (partial: Partial<Details>) => {
    setSuccess(null);
    setDetails((prev) => ({ ...prev, ...partial }));
  };

  const pickFile = async (candidate: File | null | undefined) => {
    setSuccess(null);
    if (!candidate) return;
    const problem = await validatePdf(candidate, maxMb);
    if (problem) {
      setFile(null);
      setFileError(problem);
      return;
    }
    setFileError('');
    setFile(candidate);
  };

  const clearFile = () => {
    setFile(null);
    setFileError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const missing = [
    !details.academicYearId && 'Academic Year',
    !details.semesterNo && 'Semester',
    !details.examinationType && 'Examination',
    !details.subjectCategory && 'Subject Category',
    !details.courseId && 'Subject / Course',
    !file && 'PDF file',
  ].filter(Boolean) as string[];

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!file || !selectedCourse) throw new Error('Select a subject and a PDF file.');
      const semesterNo = Number(details.semesterNo);
      const departmentId = details.departmentId || selectedCourse.departmentId || '';
      const fields: Record<string, string> = {
        academicYearId: details.academicYearId,
        semesterNo: details.semesterNo,
        examinationType: details.examinationType,
        programVersionId,
        departmentId,
        courseId: selectedCourse.id,
        paperCode: selectedCourse.code,
        paperName: selectedCourse.title,
        subjectCategory: details.subjectCategory,
        paperType: details.subjectCategory === 'PRACTICAL' ? 'PRACTICAL' : 'THEORY',
        examYear: String(examYearFor(selectedYear, semesterNo)),
        language: 'EN',
        showOnWebsite: String(showOnWebsite),
      };
      const form = new FormData();
      for (const [key, value] of Object.entries(fields)) if (value) form.append(key, value);
      form.append('file', file);

      const controller = new AbortController();
      abortRef.current = controller;
      const startedAt = performance.now();
      setProgress({ loaded: 0, total: file.size, speed: 0, etaSeconds: null });
      return paperFromResponse(
        await createQuestionPaper(form, {
          signal: controller.signal,
          onProgress: ({ loaded, total }) => {
            const size = total || file.size;
            const elapsed = (performance.now() - startedAt) / 1000;
            const speed = elapsed > 0.25 ? loaded / elapsed : 0;
            setProgress({
              loaded,
              total: size,
              speed,
              etaSeconds: speed ? Math.max(0, (size - loaded) / speed) : null,
            });
          },
        }),
      );
    },
    onSettled: () => {
      abortRef.current = null;
      setProgress(null);
    },
    onSuccess: ({ paper, versionNo }) => {
      setSuccess({
        label: `${paper.paperCode} — ${paper.paperName}`,
        versionNo,
        onWebsite: paper.showOnWebsite ?? showOnWebsite,
      });
      setToast('Question paper uploaded successfully.');
      setDetails((prev) => ({ ...prev, courseId: '' }));
      clearFile();
      onDone();
    },
  });

  const canSubmit = missing.length === 0 && !fileError && !uploadMut.isPending;
  const uploadCancelled = uploadMut.isError && axios.isCancel(uploadMut.error);
  const uploadPercent = progress?.total
    ? Math.min(100, Math.round((progress.loaded / progress.total) * 100))
    : 0;
  const detailsDone = Boolean(
    details.academicYearId &&
    details.semesterNo &&
    details.examinationType &&
    details.subjectCategory &&
    details.courseId,
  );
  const fileDone = Boolean(file) && !fileError;

  const startOver = () => {
    const current = currentAcademicYear(years);
    setDetails(emptyDetails(current?.id ?? ''));
    clearFile();
    setSuccess(null);
    uploadMut.reset();
  };

  const selectedDeptName = deptsQuery.data?.find(
    (d) => d.id === (details.departmentId || selectedCourse?.departmentId),
  )?.name;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Upload Question Paper</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select the paper details and upload the PDF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <Button type="button" variant="outline" onClick={() => setBulkOpen(true)}>
              <Layers className="mr-1.5 h-4 w-4" /> Bulk Upload
            </Button>
          ) : null}
          {repositoryHref ? (
            <Button type="button" variant="outline" asChild>
              <Link href={repositoryHref}>
                <FileText className="mr-1.5 h-4 w-4" /> View Repository
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form
          className="space-y-6 rounded-xl bg-card p-5 shadow-sm ring-1 ring-border/60 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) uploadMut.mutate();
          }}
          noValidate
        >
          {success ? (
            <div
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-emerald-50 p-4 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-900"
              role="status"
            >
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                <div>
                  <p className="font-semibold">Question paper uploaded successfully.</p>
                  <p className="text-sm">
                    {success.label}
                    {success.versionNo
                      ? ` replaced the earlier file (version ${success.versionNo}).`
                      : ' is now published.'}{' '}
                    Students can see it on their dashboard and in the mobile app
                    {success.onWebsite ? ', and it is listed on the college website.' : '.'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setSuccess(null);
                    document.getElementById('qb-course')?.focus();
                  }}
                >
                  Upload Another
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={startOver}>
                  Start over
                </Button>
              </div>
            </div>
          ) : null}

          <fieldset
            className="min-w-0 space-y-5"
            aria-labelledby="qb-details-heading"
            disabled={uploadMut.isPending}
          >
            <SectionHeading
              id="qb-details-heading"
              step={1}
              title="Paper Details"
              description="Choose where this paper belongs."
              done={detailsDone}
            />
            <GroupLabel>Examination</GroupLabel>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Academic Year" htmlFor="qb-year" required>
                <select
                  id="qb-year"
                  className={fieldClass}
                  value={details.academicYearId}
                  onChange={(e) => patch({ academicYearId: e.target.value })}
                  disabled={yearsQuery.isLoading}
                >
                  <option value="">
                    {yearsQuery.isLoading ? 'Loading…' : 'Select academic year'}
                  </option>
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Semester" htmlFor="qb-semester" required>
                <select
                  id="qb-semester"
                  className={fieldClass}
                  value={details.semesterNo}
                  onChange={(e) => patch({ semesterNo: e.target.value, courseId: '' })}
                >
                  <option value="">Select semester</option>
                  {SEMESTERS.map((n) => (
                    <option key={n} value={n}>
                      Semester {n}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Examination" htmlFor="qb-exam" required>
                <select
                  id="qb-exam"
                  className={fieldClass}
                  value={details.examinationType}
                  onChange={(e) => patch({ examinationType: e.target.value })}
                >
                  {EXAMINATION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <GroupLabel>Subject</GroupLabel>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Programme" htmlFor="qb-programme">
                <select
                  id="qb-programme"
                  className={fieldClass}
                  value={details.programId}
                  disabled={programsQuery.isLoading}
                  onChange={(e) => {
                    const program = programs.find((p) => p.id === e.target.value);
                    patch({
                      programId: e.target.value,
                      departmentId: program?.departmentId ?? details.departmentId,
                      courseId: '',
                    });
                  }}
                >
                  <option value="">
                    {programsQuery.isLoading ? 'Loading…' : 'All programmes'}
                  </option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Department" htmlFor="qb-department">
                <QbSearchableSelect
                  id="qb-department"
                  value={details.departmentId}
                  options={departmentOptions}
                  onChange={(departmentId) => patch({ departmentId, courseId: '' })}
                  placeholder="All departments"
                  searchPlaceholder="Search department…"
                  emptyText="No departments found"
                  clearLabel="All departments"
                  itemNoun="department"
                  loading={deptsQuery.isLoading}
                />
              </Field>
              <Field label="Subject Category" htmlFor="qb-category" required>
                <select
                  id="qb-category"
                  className={fieldClass}
                  value={details.subjectCategory}
                  onChange={(e) => patch({ subjectCategory: e.target.value, courseId: '' })}
                >
                  <option value="">Select category</option>
                  {SUBJECT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Subject / Course"
                htmlFor="qb-course"
                required
                className="sm:col-span-2 xl:col-span-3"
                hint={
                  !details.semesterNo
                    ? 'Select a semester to see its subjects.'
                    : coursesQuery.isSuccess && !courses.length
                      ? 'No subjects match. Try another category, or clear the programme or department.'
                      : coursesQuery.isSuccess && !details.courseId
                        ? `${courses.length} subject${courses.length === 1 ? '' : 's'} available for Semester ${details.semesterNo}.`
                        : undefined
                }
              >
                <QbSearchableSelect
                  id="qb-course"
                  value={details.courseId}
                  options={courseOptions}
                  onChange={(courseId) => {
                    const course = courses.find((c) => c.id === courseId);
                    patch({
                      courseId,
                      departmentId: details.departmentId || course?.departmentId || '',
                      subjectCategory:
                        details.subjectCategory || normalizeCategory(course?.category),
                    });
                  }}
                  placeholder={
                    details.semesterNo ? 'Search subject or code' : 'Select semester first'
                  }
                  searchPlaceholder="Search by subject name or code…"
                  emptyText="No subjects found"
                  itemNoun="subject"
                  disabled={!details.semesterNo}
                  loading={coursesQuery.isFetching && !courses.length}
                />
              </Field>
            </div>

            {selectedCourse ? (
              <div className="flex items-start gap-3 rounded-xl bg-gradient-to-r from-primary/[0.07] to-transparent p-4 ring-1 ring-primary/15">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BookOpen className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold leading-snug">
                    <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary">
                      {selectedCourse.code}
                    </span>
                    <span className="min-w-0">{selectedCourse.title}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {[
                      selectedYear?.name,
                      `Semester ${details.semesterNo}`,
                      EXAM_LABELS[details.examinationType],
                      details.subjectCategory
                        ? (CATEGORY_LABELS[details.subjectCategory] ?? details.subjectCategory)
                        : null,
                      selectedDeptName,
                      `Exam year ${examYearFor(selectedYear, Number(details.semesterNo))}`,
                    ]
                      .filter(Boolean)
                      .map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full bg-card px-2.5 py-0.5 text-muted-foreground ring-1 ring-border/70"
                        >
                          {chip}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            ) : null}
          </fieldset>

          <div className="h-px bg-border/60" />

          <section className="space-y-4" aria-labelledby="qb-file-heading">
            <SectionHeading
              id="qb-file-heading"
              step={2}
              title="Upload PDF"
              description="Select the question paper file."
              done={fileDone}
            />

            <input
              ref={fileInputRef}
              id="qb-file"
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => void pickFile(e.target.files?.[0])}
            />

            {uploadMut.isPending && progress && file ? (
              <UploadProgressPanel
                fileName={file.name}
                progress={progress}
                percent={uploadPercent}
                onCancel={() => abortRef.current?.abort()}
              />
            ) : file ? (
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50/60 p-4 ring-1 ring-emerald-200 dark:bg-emerald-950/20 dark:ring-emerald-900">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/40">
                  <FileText className="h-6 w-6" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={file.name}>
                    {file.name}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                    {formatBytes(file.size)} · PDF ready to upload
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Change
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Remove PDF"
                  onClick={clearFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void pickFile(e.dataTransfer.files?.[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-all',
                  dragging
                    ? 'scale-[1.01] border-primary bg-primary/10'
                    : 'border-primary/30 bg-primary/[0.02] hover:border-primary/60 hover:bg-primary/[0.05]',
                  fileError && 'border-destructive/60 bg-destructive/[0.03]',
                )}
              >
                <span
                  className={cn(
                    'flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform',
                    dragging ? 'scale-110' : 'group-hover:scale-105',
                  )}
                >
                  <CloudUpload className="h-8 w-8" aria-hidden />
                </span>
                <p className="text-base font-semibold">
                  {dragging ? 'Drop the PDF to attach it' : 'Drag & drop your PDF here'}
                </p>
                <p className="text-xs text-muted-foreground">or</p>
                <Button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <FileUp className="mr-1.5 h-4 w-4" /> Choose PDF File
                </Button>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-2.5 py-0.5">PDF only</span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5">Max {maxMb} MB</span>
                </div>
              </div>
            )}

            {fileError ? (
              <p
                className="flex items-center gap-1.5 text-sm font-medium text-destructive"
                role="alert"
              >
                <Info className="h-4 w-4 shrink-0" aria-hidden /> {fileError}
              </p>
            ) : null}

            <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-muted/40 px-4 py-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                checked={showOnWebsite}
                disabled={uploadMut.isPending}
                onChange={(e) => setShowOnWebsite(e.target.checked)}
              />
              <span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Globe className="h-4 w-4 text-primary" aria-hidden /> Also show on the college
                  website
                </span>
                <span className="block text-xs text-muted-foreground">
                  Students always see published papers on their dashboard and in the mobile app.
                </span>
              </span>
            </label>
          </section>

          {uploadCancelled ? (
            <p
              className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground"
              role="status"
            >
              Upload cancelled. Your details and file are still selected. Click Upload to try again.
            </p>
          ) : uploadMut.isError ? (
            <p
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {apiErrorMessage(uploadMut.error, 'Upload failed. Please try again.')}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={startOver}
              disabled={uploadMut.isPending}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" /> Reset
            </Button>
            <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
              <Button type="submit" size="lg" disabled={!canSubmit} className="sm:min-w-[220px]">
                {uploadMut.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {uploadPercent >= 100 ? 'Finishing…' : `Uploading ${uploadPercent}%`}
                  </>
                ) : (
                  <>
                    <CloudUpload className="mr-2 h-4 w-4" /> Upload Question Paper
                  </>
                )}
              </Button>
              {missing.length && !uploadMut.isPending ? (
                <p className="text-xs text-muted-foreground">Still needed: {missing.join(', ')}</p>
              ) : null}
            </div>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-xl bg-primary/5 p-5 ring-1 ring-primary/15">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
              <FileText className="h-4 w-4" aria-hidden /> Upload Guidelines
            </h3>
            <ol className="mt-3 space-y-3 text-sm">
              {[
                'Upload PDF files only.',
                `Maximum file size: ${maxMb} MB.`,
                'Select the correct academic year, semester, examination, programme, department and subject.',
                'The paper is published immediately to the student dashboard, the mobile app and (if ticked) the college website.',
              ].map((text, index) => (
                <li key={text} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="text-muted-foreground">{text}</span>
                </li>
              ))}
            </ol>
          </div>

          {recent.length ? (
            <div className="rounded-xl bg-card p-5 shadow-sm ring-1 ring-border/60">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Recent Uploads</h3>
                {repositoryHref ? (
                  <Link
                    href={repositoryHref}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View all
                  </Link>
                ) : null}
              </div>
              <ul className="mt-3 space-y-2">
                {recent.map((paper) => (
                  <li
                    key={paper.id}
                    className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted/40"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600 dark:bg-red-950/40">
                      <FileText className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-medium"
                        title={`${paper.paperCode} — ${paper.paperName}`}
                      >
                        {paper.paperCode} — {paper.paperName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[
                          paper.semesterNo ? `Semester ${paper.semesterNo}` : null,
                          paper.examinationType
                            ? (EXAM_LABELS[paper.examinationType] ?? paper.examinationType)
                            : null,
                          new Date(paper.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          }),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <StatusBadge status={paper.status} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      {toast ? (
        <div
          className="fixed bottom-5 right-5 z-[10000] flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden /> {toast}
          <button
            type="button"
            aria-label="Dismiss"
            className="ml-2 opacity-80 hover:opacity-100"
            onClick={() => setToast('')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {canManage ? (
        <QuestionBankBulkImportDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          onImported={(count) => {
            setToast(`${count} question paper${count === 1 ? '' : 's'} imported successfully.`);
            onDone();
          }}
        />
      ) : null}
    </div>
  );
}
