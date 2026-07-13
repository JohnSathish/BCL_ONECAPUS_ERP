'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FileText, Search, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchAcademicDepartments, fetchAcademicYears } from '@/services/organization';
import {
  createSyllabusDocument,
  downloadSyllabusBulkTemplate,
  extractSyllabusHints,
  fetchSyllabusDashboard,
  fetchSyllabusSettings,
  preflightSyllabusDocument,
  previewSyllabusBulk,
  commitSyllabusBulk,
  publishSyllabusDocument,
  searchSyllabusCourses,
  submitSyllabusDocument,
} from '@/services/syllabus-repository';
import type {
  SyllabusBulkPreviewResponse,
  SyllabusCourseLookup,
  SyllabusExtractHintsResponse,
  SyllabusPreflightResponse,
  SyllabusVersionMode,
} from '@/types/syllabus-repository';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type WizardMeta = {
  courseId: string;
  paperCode: string;
  paperTitle: string;
  credits: string;
  departmentId: string;
  departmentName: string;
  programId: string;
  programVersionId: string;
  programmeName: string;
  semesterNo: string;
  category: string;
  subjectType: string;
  academicYearId: string;
  curriculumVersion: string;
  notes: string;
};

const emptyMeta = (): WizardMeta => ({
  courseId: '',
  paperCode: '',
  paperTitle: '',
  credits: '',
  departmentId: '',
  departmentName: '',
  programId: '',
  programVersionId: '',
  programmeName: '',
  semesterNo: '',
  category: '',
  subjectType: '',
  academicYearId: '',
  curriculumVersion: '',
  notes: '',
});

const STEPS = ['Select Subject', 'Verify Information', 'Upload PDF'] as const;

function formatBytes(n?: number | null) {
  if (n == null || Number.isNaN(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function courseToMeta(course: SyllabusCourseLookup, academicYearId = ''): WizardMeta {
  return {
    courseId: course.id,
    paperCode: course.code,
    paperTitle: course.title,
    credits: course.credits == null ? '' : String(course.credits),
    departmentId: course.departmentId ?? '',
    departmentName: course.departmentName ?? '',
    programId: course.programId ?? course.programIdHint ?? '',
    programVersionId: course.programVersionId ?? course.programVersionIdHint ?? '',
    programmeName: course.programmeName ?? '',
    semesterNo:
      course.semesterNo != null
        ? String(course.semesterNo)
        : course.semesterNoHint != null
          ? String(course.semesterNoHint)
          : '',
    category: course.category ?? course.categoryHint ?? '',
    subjectType: course.subjectType ?? '',
    academicYearId,
    curriculumVersion: course.curriculumVersion ?? '',
    notes: '',
  };
}

type Props = {
  canManage?: boolean;
  canPublish?: boolean;
  onDone: () => void;
};

export function SyllabusUploadWizard({ canManage, canPublish, onDone }: Props) {
  const queryEnabled = useAuthQueryEnabled();
  const { session } = useAuth();
  const canEditMeta =
    Boolean(session?.user?.permissions?.includes('syllabus-repository:manage')) ||
    Boolean(session?.user?.permissions?.includes('academic:manage')) ||
    Boolean(canManage);

  const [tab, setTab] = useState<'single' | 'bulk'>('single');
  const [step, setStep] = useState(0);
  const [searchQ, setSearchQ] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterSem, setFilterSem] = useState('');
  const [filterType, setFilterType] = useState('');
  const [meta, setMeta] = useState<WizardMeta>(emptyMeta());
  const [editMeta, setEditMeta] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState('');
  const [progress, setProgress] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<SyllabusPreflightResponse | null>(null);
  const [showDupDialog, setShowDupDialog] = useState(false);
  const [hints, setHints] = useState<SyllabusExtractHintsResponse | null>(null);
  const [pendingPublish, setPendingPublish] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [bulkExcel, setBulkExcel] = useState<File | null>(null);
  const [bulkZip, setBulkZip] = useState<File | null>(null);
  const [bulkPreview, setBulkPreview] = useState<SyllabusBulkPreviewResponse | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['syllabus-repository', 'settings'],
    queryFn: fetchSyllabusSettings,
    enabled: queryEnabled,
    retry: false,
  });
  const maxMb = settingsQuery.data?.maxUploadMb ?? 25;

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
  const dashboardQuery = useQuery({
    queryKey: ['syllabus-repository', 'dashboard'],
    queryFn: fetchSyllabusDashboard,
    enabled: queryEnabled,
  });

  const searchEnabled =
    queryEnabled && (searchQ.trim().length >= 2 || !!filterDept || !!filterSem || !!filterType);
  const searchQuery = useQuery({
    queryKey: ['syllabus-repository', 'course-search', searchQ, filterDept, filterSem, filterType],
    queryFn: () =>
      searchSyllabusCourses({
        q: searchQ.trim() || undefined,
        departmentId: filterDept || undefined,
        semesterNo: filterSem ? Number(filterSem) : undefined,
        subjectType: filterType || undefined,
        limit: 20,
      }),
    enabled: searchEnabled,
  });

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const active = yearsQuery.data?.find((y) => y.status === 'ACTIVE') ?? yearsQuery.data?.[0];
    if (active?.id && !meta.academicYearId) {
      setMeta((prev) => ({ ...prev, academicYearId: active.id }));
    }
  }, [yearsQuery.data, meta.academicYearId]);

  const patchMeta = (partial: Partial<WizardMeta>) => setMeta((prev) => ({ ...prev, ...partial }));

  const selectCourse = (course: SyllabusCourseLookup) => {
    const yearId =
      meta.academicYearId ||
      yearsQuery.data?.find((y) => y.status === 'ACTIVE')?.id ||
      yearsQuery.data?.[0]?.id ||
      '';
    setMeta(courseToMeta(course, yearId));
    setEditMeta(false);
    setHints(null);
    setPreflight(null);
    setStep(1);
  };

  const acceptFile = (f: File | null) => {
    setFileError('');
    setHints(null);
    if (!f) {
      setFile(null);
      return;
    }
    const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setFileError('Only PDF files are accepted');
      return;
    }
    if (f.size > maxMb * 1024 * 1024) {
      setFileError(`Maximum file size is ${maxMb} MB`);
      return;
    }
    setFile(f);
  };

  const checklist = useMemo(
    () => ({
      subject: Boolean(meta.courseId),
      metadata: Boolean(meta.paperCode && meta.paperTitle),
      pdf: Boolean(file),
      pdfFormat: Boolean(
        file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')),
      ),
      pdfSize: Boolean(file && file.size <= maxMb * 1024 * 1024),
      aiOk: !hints || hints.mismatches.length === 0,
    }),
    [meta, file, maxMb, hints],
  );

  const readyToSave =
    checklist.subject &&
    checklist.metadata &&
    checklist.pdf &&
    checklist.pdfFormat &&
    checklist.pdfSize;

  useEffect(() => {
    if (!file || !meta.courseId || step !== 2) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('courseId', meta.courseId);
    fd.append('paperCode', meta.paperCode);
    fd.append('paperTitle', meta.paperTitle);
    if (meta.credits) fd.append('credits', meta.credits);
    extractSyllabusHints(fd)
      .then(setHints)
      .catch(() => setHints(null));
  }, [file, meta.courseId, meta.paperCode, meta.paperTitle, meta.credits, step]);

  const buildFormData = (versionMode: SyllabusVersionMode) => {
    if (!file) throw new Error('PDF is required');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('courseId', meta.courseId);
    fd.append('paperCode', meta.paperCode);
    fd.append('paperTitle', meta.paperTitle);
    fd.append('versionMode', versionMode);
    if (meta.departmentId) fd.append('departmentId', meta.departmentId);
    if (meta.programId) fd.append('programId', meta.programId);
    if (meta.programVersionId) fd.append('programVersionId', meta.programVersionId);
    if (meta.academicYearId) fd.append('academicYearId', meta.academicYearId);
    if (meta.semesterNo) fd.append('semesterNo', meta.semesterNo);
    if (meta.credits) fd.append('credits', meta.credits);
    if (meta.category) fd.append('category', meta.category);
    if (meta.subjectType) fd.append('subjectType', meta.subjectType);
    if (meta.curriculumVersion) fd.append('curriculumVersion', meta.curriculumVersion);
    if (meta.notes) fd.append('notes', meta.notes);
    return fd;
  };

  const resolveDocumentId = (result: Awaited<ReturnType<typeof createSyllabusDocument>>) => {
    if (result && typeof result === 'object' && 'document' in result) {
      return result.document.id;
    }
    return (result as { id: string }).id;
  };

  const uploadMut = useMutation({
    mutationFn: async (opts: { publish: boolean; versionMode: SyllabusVersionMode }) => {
      setError('');
      setMessage('');
      setProgress('Uploading...');
      const result = await createSyllabusDocument(buildFormData(opts.versionMode));
      const id = resolveDocumentId(result);
      setProgress('Processing PDF...');
      if (opts.publish) {
        if (!canPublish) {
          try {
            await submitSyllabusDocument(id);
            setProgress(null);
            setMessage(
              'Saved and submitted for approval. Use Workflow if further action is needed.',
            );
          } catch {
            setProgress(null);
            setMessage(
              'Saved as draft. You do not have publish permission — use Approval Workflow.',
            );
          }
          return result;
        }
        setProgress('Publishing...');
        await publishSyllabusDocument(id);
        setMessage('Syllabus published. Students and portals will see the latest version.');
      } else {
        setMessage('Syllabus saved as draft.');
      }
      setProgress('Completed');
      return result;
    },
    onSuccess: () => {
      setTimeout(() => {
        setProgress(null);
        setFile(null);
        setMeta(emptyMeta());
        setStep(0);
        setHints(null);
        setPreflight(null);
        setShowDupDialog(false);
        onDone();
      }, 600);
    },
    onError: (err) => {
      setProgress(null);
      setError(apiErrorMessage(err));
    },
  });

  const runSave = async (publish: boolean) => {
    if (!readyToSave) {
      setError('Select a subject, verify metadata, and attach a PDF first.');
      return;
    }
    setProgress('Checking for existing syllabus...');
    try {
      const pf = await preflightSyllabusDocument({
        courseId: meta.courseId,
        academicYearId: meta.academicYearId || undefined,
        semesterNo: meta.semesterNo ? Number(meta.semesterNo) : undefined,
        category: meta.category || undefined,
      });
      setPreflight(pf);
      if (pf.exists) {
        setProgress(null);
        setPendingPublish(publish);
        setShowDupDialog(true);
        return;
      }
      uploadMut.mutate({ publish, versionMode: 'reject_if_exists' });
    } catch (err) {
      setProgress(null);
      setError(apiErrorMessage(err));
    }
  };

  const confirmVersion = (publish: boolean) => {
    setShowDupDialog(false);
    uploadMut.mutate({ publish, versionMode: 'new_version' });
  };

  const bulkPreviewMut = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      if (bulkExcel) fd.append('excel', bulkExcel);
      if (bulkZip) fd.append('zip', bulkZip);
      return previewSyllabusBulk(fd);
    },
    onSuccess: setBulkPreview,
  });

  const bulkCommitMut = useMutation({
    mutationFn: async () => {
      const rows =
        bulkPreview?.rows.filter((row) => row.status === 'VALID').map((row) => row.normalized!) ??
        [];
      return commitSyllabusBulk(rows, bulkZip ?? undefined);
    },
    onSuccess: () => {
      setBulkPreview(null);
      setBulkExcel(null);
      setBulkZip(null);
      onDone();
    },
  });

  const kpis = dashboardQuery.data?.kpis;
  const yearLabel =
    yearsQuery.data?.find((y) => y.id === meta.academicYearId)?.name ?? meta.academicYearId;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Upload Syllabus</h2>
          <p className="text-sm text-muted-foreground">
            Search the subject, verify Course Master details, then drop the PDF — under 30 seconds.
          </p>
        </div>
        <div className="inline-flex rounded-full border bg-muted/40 p-1 text-sm">
          <button
            type="button"
            className={cn(
              'rounded-full px-4 py-1.5 font-medium transition',
              tab === 'single' ? 'bg-background shadow-sm' : 'text-muted-foreground',
            )}
            onClick={() => setTab('single')}
          >
            Single Upload
          </button>
          <button
            type="button"
            className={cn(
              'rounded-full px-4 py-1.5 font-medium transition',
              tab === 'bulk' ? 'bg-background shadow-sm' : 'text-muted-foreground',
              !canManage && 'opacity-50',
            )}
            disabled={!canManage}
            onClick={() => canManage && setTab('bulk')}
          >
            Bulk Upload
          </button>
        </div>
      </div>

      {tab === 'bulk' ? (
        <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="font-semibold">Bulk Import (Excel + ZIP of PDFs)</h3>
          <p className="text-sm text-muted-foreground">
            Download the template, fill paper codes, zip matching PDFs named by paper code, then
            preview before commit.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                const blob = await downloadSyllabusBulkTemplate();
                downloadBlob(blob, 'syllabus-repository-template.xlsx');
              }}
            >
              Download Excel Template
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span>Excel file</span>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setBulkExcel(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>ZIP of PDFs</span>
              <Input
                type="file"
                accept=".zip"
                onChange={(e) => setBulkZip(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={!bulkExcel || bulkPreviewMut.isPending}
              onClick={() => bulkPreviewMut.mutate()}
            >
              Preview
            </Button>
            <Button
              disabled={!bulkPreview?.summary.valid || bulkCommitMut.isPending}
              onClick={() => bulkCommitMut.mutate()}
            >
              Commit {bulkPreview?.summary.valid ?? 0} rows
            </Button>
          </div>
          {bulkPreview ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {bulkPreview.summary.valid} valid / {bulkPreview.summary.invalid} invalid /{' '}
                {bulkPreview.zipFileCount} ZIP files
              </p>
              {bulkPreview.rows.some((r) => r.status === 'INVALID') ? (
                <div className="max-h-64 overflow-auto rounded-xl border">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-muted/80">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPreview.rows
                        .filter((r) => r.status === 'INVALID')
                        .map((row) => (
                          <tr key={row.rowNumber} className="border-t">
                            <td className="px-3 py-2 align-top">{row.rowNumber}</td>
                            <td className="px-3 py-2 text-destructive">{row.errors.join('; ')}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
          {bulkPreviewMut.isError ? (
            <p className="text-sm text-destructive">{apiErrorMessage(bulkPreviewMut.error)}</p>
          ) : null}
          {bulkCommitMut.isError ? (
            <p className="text-sm text-destructive">{apiErrorMessage(bulkCommitMut.error)}</p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <ol className="flex flex-wrap gap-2">
              {STEPS.map((label, i) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => {
                      if (i === 0 || (i === 1 && meta.courseId) || (i === 2 && meta.courseId)) {
                        setStep(i);
                      }
                    }}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                      step === i
                        ? 'bg-slate-900 text-white'
                        : step > i
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    Step {i + 1}: {label}
                  </button>
                </li>
              ))}
            </ol>

            {step === 0 ? (
              <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search by paper code, subject name, or department…"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.data?.items[0]) {
                        selectCourse(searchQuery.data.items[0]);
                      }
                    }}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="space-y-1 text-sm">
                    <span>Department</span>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={filterDept}
                      onChange={(e) => setFilterDept(e.target.value)}
                    >
                      <option value="">All</option>
                      {(deptsQuery.data ?? []).map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name || d.code}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span>Semester</span>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={filterSem}
                      onChange={(e) => setFilterSem(e.target.value)}
                      placeholder="e.g. 3"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span>Subject Type</span>
                    <Input
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      placeholder="MAJOR / MINOR…"
                    />
                  </label>
                </div>
                <div className="max-h-80 space-y-2 overflow-auto">
                  {!searchEnabled ? (
                    <p className="text-sm text-muted-foreground">
                      Type at least 2 characters or choose a filter to list subjects.
                    </p>
                  ) : searchQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Searching…</p>
                  ) : searchQuery.data?.items.length ? (
                    searchQuery.data.items.map((course) => (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => selectCourse(course)}
                        className="flex w-full flex-col rounded-xl border px-4 py-3 text-left transition hover:border-sky-300 hover:bg-sky-50/50"
                      >
                        <span className="font-semibold">
                          {course.code} — {course.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {[
                            course.departmentName,
                            course.semesterNo != null ? `Sem ${course.semesterNo}` : null,
                            course.category,
                            course.credits != null ? `${course.credits} cr` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No subjects found.</p>
                  )}
                </div>
                {searchQuery.isError ? (
                  <p className="text-sm text-destructive">{apiErrorMessage(searchQuery.error)}</p>
                ) : null}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">Verify Information</h3>
                  {canEditMeta ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditMeta((v) => !v)}
                    >
                      {editMeta ? 'Lock Metadata' : 'Edit Metadata'}
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ['Paper Code', 'paperCode'],
                      ['Paper Title', 'paperTitle'],
                      ['Credits', 'credits'],
                      ['Programme', 'programmeName'],
                      ['Department', 'departmentName'],
                      ['Semester', 'semesterNo'],
                      ['Major / Minor', 'category'],
                      ['Subject Type', 'subjectType'],
                      ['Curriculum Version', 'curriculumVersion'],
                    ] as const
                  ).map(([label, key]) => (
                    <label key={key} className="space-y-1 text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <Input
                        value={meta[key]}
                        readOnly={!editMeta || key === 'programmeName' || key === 'departmentName'}
                        onChange={(e) => patchMeta({ [key]: e.target.value })}
                        className={cn(!editMeta && 'bg-muted/40')}
                      />
                    </label>
                  ))}
                  <label className="space-y-1 text-sm sm:col-span-2">
                    <span className="text-muted-foreground">Academic Year</span>
                    <select
                      className={cn(
                        'h-10 w-full rounded-md border px-3 text-sm',
                        !editMeta && 'bg-muted/40',
                      )}
                      disabled={!editMeta}
                      value={meta.academicYearId}
                      onChange={(e) => patchMeta({ academicYearId: e.target.value })}
                    >
                      <option value="">Select year</option>
                      {(yearsQuery.data ?? []).map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {editMeta ? (
                    <label className="space-y-1 text-sm sm:col-span-2">
                      <span className="text-muted-foreground">Notes</span>
                      <textarea
                        className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                        value={meta.notes}
                        onChange={(e) => patchMeta({ notes: e.target.value })}
                      />
                    </label>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep(0)}>
                    Back
                  </Button>
                  <Button type="button" onClick={() => setStep(2)} disabled={!meta.courseId}>
                    Continue to Upload
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
                <h3 className="font-semibold">Upload PDF</h3>
                {!file ? (
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      acceptFile(e.dataTransfer.files?.[0] ?? null);
                    }}
                    className={cn(
                      'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-12 transition',
                      dragging
                        ? 'border-sky-500 bg-sky-50'
                        : 'border-border bg-muted/30 hover:border-sky-300 hover:bg-sky-50/40',
                    )}
                  >
                    <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="text-sm font-semibold">Drag & Drop PDF Here</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      or Browse Files · up to {maxMb} MB
                    </p>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <FileText className="mt-0.5 h-8 w-8 shrink-0 text-emerald-700" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-emerald-950">{file.name}</p>
                          <p className="text-xs text-emerald-800">
                            {formatBytes(file.size)}
                            {hints?.pageCount != null ? ` · ${hints.pageCount} pages` : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-xs font-medium text-emerald-900 underline"
                        onClick={() => acceptFile(null)}
                      >
                        Replace
                      </button>
                    </div>
                    {previewUrl ? (
                      <iframe
                        title="PDF preview"
                        src={previewUrl}
                        className="h-80 w-full rounded-xl border"
                      />
                    ) : null}
                    {hints?.mismatches?.length ? (
                      <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                        <p className="font-semibold">AI validation suggestions</p>
                        <ul className="mt-1 list-disc pl-5 text-xs">
                          {hints.mismatches.map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    ) : hints?.readable ? (
                      <p className="flex items-center gap-2 text-xs text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> PDF text readable — no metadata
                        mismatches
                      </p>
                    ) : null}
                  </div>
                )}
                {fileError ? <p className="text-sm text-destructive">{fileError}</p> : null}

                {progress ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{progress}</p>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-full rounded-full bg-sky-600 transition-all',
                          progress === 'Completed' ? 'w-full' : 'w-2/3 animate-pulse',
                        )}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setMeta(emptyMeta());
                      setFile(null);
                      setStep(0);
                      setError('');
                      setMessage('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!readyToSave || uploadMut.isPending}
                    onClick={() => runSave(false)}
                  >
                    Save Draft
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!previewUrl}
                    onClick={() => previewUrl && window.open(previewUrl, '_blank')}
                  >
                    Preview
                  </Button>
                  <Button
                    type="button"
                    disabled={!readyToSave || uploadMut.isPending}
                    onClick={() => runSave(true)}
                  >
                    {canPublish ? 'Publish' : 'Save & Request Publish'}
                  </Button>
                </div>
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Subject Information
              </p>
              {meta.courseId ? (
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Code</dt>
                    <dd className="font-medium">{meta.paperCode}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Title</dt>
                    <dd className="max-w-[160px] truncate text-right font-medium">
                      {meta.paperTitle}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Department</dt>
                    <dd className="text-right">{meta.departmentName || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Semester</dt>
                    <dd>{meta.semesterNo || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Credits</dt>
                    <dd>{meta.credits || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Type</dt>
                    <dd>{meta.subjectType || meta.category || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Programme</dt>
                    <dd className="max-w-[160px] truncate text-right">
                      {meta.programmeName || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Year</dt>
                    <dd className="max-w-[140px] truncate text-right text-xs">
                      {yearLabel || '—'}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Select a subject to see details.
                </p>
              )}
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Upload Checklist
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {(
                  [
                    ['Subject selected', checklist.subject],
                    ['Metadata verified', checklist.metadata],
                    ['PDF uploaded', checklist.pdf],
                    ['PDF format', checklist.pdfFormat],
                    ['File size OK', checklist.pdfSize],
                    ['AI validation', checklist.aiOk || !file],
                  ] as const
                ).map(([label, ok]) => (
                  <li key={label} className="flex items-center gap-2">
                    <CheckCircle2
                      className={cn(
                        'h-4 w-4',
                        ok ? 'text-emerald-600' : 'text-muted-foreground/40',
                      )}
                    />
                    <span className={ok ? '' : 'text-muted-foreground'}>{label}</span>
                  </li>
                ))}
                <li className="flex items-center gap-2 pt-1 font-medium">
                  <CheckCircle2
                    className={cn(
                      'h-4 w-4',
                      readyToSave ? 'text-emerald-600' : 'text-muted-foreground/40',
                    )}
                  />
                  Ready to {canPublish ? 'publish' : 'save'}
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Statistics
              </p>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Total Uploaded</dt>
                  <dd className="font-semibold">{kpis?.totalDocuments ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Published</dt>
                  <dd className="font-semibold">{kpis?.publishedDocuments ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Pending Approval</dt>
                  <dd className="font-semibold">
                    {kpis?.pendingApprovals ?? kpis?.pendingDocuments ?? '—'}
                  </dd>
                </div>
                {kpis?.topDocument ? (
                  <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                    <p className="text-xs text-muted-foreground">Latest highlight</p>
                    <p className="truncate text-sm font-medium">
                      {kpis.topDocument.paperCode} — {kpis.topDocument.title}
                    </p>
                  </div>
                ) : null}
              </dl>
            </div>
          </aside>
        </div>
      )}

      {showDupDialog && preflight?.exists ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border bg-background p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" />
              <div>
                <h3 className="font-semibold">Existing Syllabus Found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {preflight.document?.paperCode} — {preflight.document?.paperTitle}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Current version</dt>
                <dd className="font-medium">Version {preflight.document?.currentVersionNo ?? 1}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Uploaded on</dt>
                <dd className="font-medium">
                  {preflight.latestVersion?.createdAt
                    ? new Date(preflight.latestVersion.createdAt).toLocaleDateString()
                    : preflight.document?.updatedAt
                      ? new Date(preflight.document.updatedAt).toLocaleDateString()
                      : '—'}
                </dd>
              </div>
            </dl>
            <p className="text-sm">
              Upload as <strong>Version {preflight.nextVersionNo ?? 'next'}</strong>? Students will
              see only the latest published version.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowDupDialog(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => confirmVersion(false)}
                disabled={uploadMut.isPending}
              >
                Upload as Version {preflight.nextVersionNo}
              </Button>
              <Button
                type="button"
                onClick={() => confirmVersion(pendingPublish)}
                disabled={uploadMut.isPending}
              >
                {pendingPublish && canPublish ? 'Version & Publish' : 'Version as Draft'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
