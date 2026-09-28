'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { CompactCard, CompactCardBody } from '@/components/erp/compact-card';
import { ERPField, erpSelectClass } from '@/components/erp/form-primitives';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  deleteQuestionPaper,
  fetchQuestionBankMasters,
  fetchQuestionBankSettings,
  fetchQuestionPaperPdf,
  fetchQuestionPapers,
  saveQuestionPaper,
  updateQuestionPaperStatus,
  type QuestionPaperFormFields,
  type QuestionPaperListParams,
} from '@/services/website-cms';
import type {
  QuestionBankMaster,
  QuestionPaperStatus,
  WebsiteQuestionPaper,
} from '@/types/website-cms';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import {
  QB_STATUS_CLASSES,
  QB_STATUS_LABELS,
  collegeSiteUrl,
  formatBytes,
  formatQbDate,
  groupMasters,
  openPdfInNewTab,
} from './question-bank-shared';

const PAGE_SIZE = 20;
const SEMESTERS = Array.from({ length: 10 }, (_, index) => index + 1);

const emptyForm = (): QuestionPaperFormFields => ({
  title: '',
  academicYearId: '',
  semester: '',
  programmeId: '',
  departmentId: '',
  majorId: '',
  subjectId: '',
  subjectName: '',
  subjectCode: '',
  examTypeId: '',
  examYear: '',
  description: '',
  publishedAt: '',
  status: 'DRAFT',
});

const formFromPaper = (paper: WebsiteQuestionPaper): QuestionPaperFormFields => ({
  title: paper.title,
  academicYearId: paper.academicYearId ?? '',
  semester: paper.semester ? String(paper.semester) : '',
  programmeId: paper.programmeId ?? '',
  departmentId: paper.departmentId ?? '',
  majorId: paper.majorId ?? '',
  subjectId: paper.subjectId ?? '',
  subjectName: paper.subjectName,
  subjectCode: paper.subjectCode,
  examTypeId: paper.examTypeId ?? '',
  examYear: paper.examYear ? String(paper.examYear) : '',
  description: paper.description,
  publishedAt: paper.publishedAt ? paper.publishedAt.slice(0, 10) : '',
  status: paper.status,
});

function MasterSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: QuestionBankMaster[];
  placeholder: string;
}) {
  const visible = options.filter((option) => option.isActive || option.id === value);
  return (
    <select
      id={id}
      className={erpSelectClass}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {visible.map((option) => (
        <option key={option.id} value={option.id}>
          {option.code && option.kind === 'SUBJECT'
            ? `${option.label} (${option.code})`
            : option.label}
          {option.isActive ? '' : ' (inactive)'}
        </option>
      ))}
    </select>
  );
}

function StatusBadge({ status }: { status: QuestionPaperStatus }) {
  return (
    <Badge variant="outline" className={cn('text-[11px]', QB_STATUS_CLASSES[status])}>
      {QB_STATUS_LABELS[status]}
    </Badge>
  );
}

export function QuestionBankPapersPanel({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<QuestionPaperListParams>({ page: 1, limit: PAGE_SIZE });
  const [searchInput, setSearchInput] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<WebsiteQuestionPaper | null>(null);
  const [form, setForm] = useState<QuestionPaperFormFields>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [viewing, setViewing] = useState<WebsiteQuestionPaper | null>(null);

  const mastersQuery = useQuery({
    queryKey: ['website', 'question-bank', 'masters', 'all'],
    queryFn: () => fetchQuestionBankMasters(),
  });
  const masters = useMemo(() => groupMasters(mastersQuery.data), [mastersQuery.data]);
  const settings = useQuery({
    queryKey: ['website', 'question-bank', 'settings'],
    queryFn: fetchQuestionBankSettings,
  });
  const papers = useQuery({
    queryKey: ['website', 'question-bank', 'papers', filters],
    queryFn: () => fetchQuestionPapers(filters),
    placeholderData: (previous) => previous,
  });

  const maxUploadMb = settings.data?.maxUploadMb ?? 20;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['website', 'question-bank'] });

  const setFilter = (patch: Partial<QuestionPaperListParams>) =>
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));

  const openEditor = (paper: WebsiteQuestionPaper | null) => {
    setEditing(paper);
    setForm(paper ? formFromPaper(paper) : emptyForm());
    setFile(null);
    setFileError('');
    setEditorOpen(true);
  };

  const updateForm = (patch: Partial<QuestionPaperFormFields>) =>
    setForm((current) => ({ ...current, ...patch }));

  const onSubjectChange = (subjectId: string) => {
    const subject = masters.SUBJECT.find((row) => row.id === subjectId);
    updateForm({
      subjectId,
      ...(subject
        ? {
            subjectName: subject.label,
            subjectCode: subject.code ?? '',
            ...(subject.parentId && !form.departmentId ? { departmentId: subject.parentId } : {}),
          }
        : {}),
    });
  };

  const onFileChange = (selected: File | null) => {
    setFileError('');
    if (!selected) {
      setFile(null);
      return;
    }
    const isPdf =
      selected.name.toLowerCase().endsWith('.pdf') &&
      (!selected.type || selected.type === 'application/pdf');
    if (!isPdf) {
      setFile(null);
      setFileError('Only PDF files (.pdf) can be uploaded.');
      return;
    }
    if (selected.size > maxUploadMb * 1024 * 1024) {
      setFile(null);
      setFileError(`PDF is larger than the ${maxUploadMb} MB limit.`);
      return;
    }
    setFile(selected);
  };

  const save = useMutation({
    mutationFn: () => saveQuestionPaper(editing?.id ?? null, form, file),
    onSuccess: (paper) => {
      onMessage(editing ? `Updated “${paper.title}”.` : `Added “${paper.title}”.`);
      setEditorOpen(false);
      void invalidate();
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not save question paper')),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuestionPaperStatus }) =>
      updateQuestionPaperStatus(id, status),
    onSuccess: (paper) => {
      onMessage(`“${paper.title}” is now ${QB_STATUS_LABELS[paper.status].toLowerCase()}.`);
      setViewing((current) => (current?.id === paper.id ? paper : current));
      void invalidate();
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not change status')),
  });

  const remove = useMutation({
    mutationFn: deleteQuestionPaper,
    onSuccess: () => {
      onMessage('Question paper deleted.');
      setViewing(null);
      void invalidate();
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not delete question paper')),
  });

  const previewPdf = (paper: WebsiteQuestionPaper) => {
    void openPdfInNewTab(() => fetchQuestionPaperPdf(paper.id)).catch((error) =>
      onMessage(apiErrorMessage(error, 'Could not open PDF')),
    );
  };

  const confirmDelete = (paper: WebsiteQuestionPaper) => {
    if (window.confirm(`Delete “${paper.title}” and its PDF permanently? This cannot be undone.`)) {
      remove.mutate(paper.id);
    }
  };

  const counts = papers.data?.statusCounts;
  const allCount = counts ? counts.DRAFT + counts.PUBLISHED + counts.ARCHIVED : undefined;
  const statusTabs: Array<{ value?: QuestionPaperStatus; label: string; count?: number }> = [
    { label: 'All', count: allCount },
    { value: 'PUBLISHED', label: 'Published', count: counts?.PUBLISHED },
    { value: 'DRAFT', label: 'Draft', count: counts?.DRAFT },
    { value: 'ARCHIVED', label: 'Archived', count: counts?.ARCHIVED },
  ];

  const rowActions = (paper: WebsiteQuestionPaper) => (
    <div className="flex flex-wrap justify-end gap-0.5">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label={`View ${paper.title}`}
        onClick={() => setViewing(paper)}
      >
        <Eye className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label={`Edit ${paper.title}`}
        onClick={() => openEditor(paper)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      {paper.file ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={`Preview PDF of ${paper.title}`}
          onClick={() => previewPdf(paper)}
        >
          <FileText className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      {paper.status === 'PUBLISHED' ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={`Unpublish ${paper.title}`}
          title="Unpublish (move to draft)"
          onClick={() => setStatus.mutate({ id: paper.id, status: 'DRAFT' })}
        >
          <EyeOff className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={`Publish ${paper.title}`}
          title={paper.file ? 'Publish' : 'Upload a PDF before publishing'}
          disabled={!paper.file}
          onClick={() => setStatus.mutate({ id: paper.id, status: 'PUBLISHED' })}
        >
          <Globe className="h-3.5 w-3.5 text-emerald-600" />
        </Button>
      )}
      {paper.status === 'ARCHIVED' ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={`Restore ${paper.title} as draft`}
          title="Restore as draft"
          onClick={() => setStatus.mutate({ id: paper.id, status: 'DRAFT' })}
        >
          <ArchiveRestore className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={`Archive ${paper.title}`}
          title="Archive"
          onClick={() => setStatus.mutate({ id: paper.id, status: 'ARCHIVED' })}
        >
          <Archive className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label={`Delete ${paper.title}`}
        onClick={() => confirmDelete(paper)}
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );

  const list = papers.data;

  return (
    <>
      <CompactCard>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold leading-tight">Question papers</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Only published papers with a PDF appear on the public website. Drafts and archived
              papers stay private.
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => openEditor(null)}>
            <Plus className="mr-1 h-4 w-4" /> Add question paper
          </Button>
        </div>
        <CompactCardBody className="space-y-3">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
            {statusTabs.map((tab) => {
              const active = filters.status === tab.value;
              return (
                <button
                  key={tab.label}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter({ status: tab.value })}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted',
                  )}
                >
                  {tab.label}
                  {tab.count !== undefined ? (
                    <span className="ml-1.5 opacity-80">{tab.count}</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="grid gap-2 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
            <form
              className="flex gap-2"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                setFilter({ q: searchInput.trim() || undefined });
              }}
            >
              <Input
                aria-label="Search question papers"
                placeholder="Search title, subject, code…"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="h-9 text-sm"
              />
              <Button type="submit" size="sm" variant="outline" className="h-9" aria-label="Search">
                <Search className="h-4 w-4" />
              </Button>
            </form>
            <MasterSelect
              id="qb-filter-year"
              value={filters.academicYearId ?? ''}
              onChange={(value) => setFilter({ academicYearId: value || undefined })}
              options={masters.ACADEMIC_YEAR}
              placeholder="All academic years"
            />
            <MasterSelect
              id="qb-filter-programme"
              value={filters.programmeId ?? ''}
              onChange={(value) => setFilter({ programmeId: value || undefined })}
              options={masters.PROGRAMME}
              placeholder="All programmes"
            />
            <MasterSelect
              id="qb-filter-department"
              value={filters.departmentId ?? ''}
              onChange={(value) => setFilter({ departmentId: value || undefined })}
              options={masters.DEPARTMENT}
              placeholder="All departments"
            />
            <MasterSelect
              id="qb-filter-exam-type"
              value={filters.examTypeId ?? ''}
              onChange={(value) => setFilter({ examTypeId: value || undefined })}
              options={masters.EXAM_TYPE}
              placeholder="All exam types"
            />
          </div>

          {papers.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading question papers…</p>
          ) : papers.isError ? (
            <p className="text-sm text-destructive">
              {apiErrorMessage(papers.error, 'Could not load question papers')}
            </p>
          ) : !list?.items.length ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">No question papers found</p>
              <p className="text-xs text-muted-foreground">
                {allCount
                  ? 'Try clearing the search or filters.'
                  : 'Add master data first, then upload your first question paper.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Paper</th>
                    <th className="px-3 py-2 font-semibold">Programme / Sem</th>
                    <th className="px-3 py-2 font-semibold">Academic year</th>
                    <th className="px-3 py-2 font-semibold">Exam type</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Published</th>
                    <th className="px-3 py-2 font-semibold">PDF</th>
                    <th className="px-3 py-2 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((paper) => (
                    <tr key={paper.id} className="border-t border-border/60 align-top">
                      <td className="px-3 py-2">
                        <p className="font-medium leading-snug">{paper.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {[paper.subjectCode, paper.subjectName].filter(Boolean).join(' · ') ||
                            '—'}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <p>{paper.programme?.label ?? '—'}</p>
                        <p className="text-muted-foreground">
                          {paper.semester ? `Semester ${paper.semester}` : ''}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-xs">{paper.academicYear?.label ?? '—'}</td>
                      <td className="px-3 py-2 text-xs">{paper.examType?.label ?? '—'}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={paper.status} />
                      </td>
                      <td className="px-3 py-2 text-xs">{formatQbDate(paper.publishedAt)}</td>
                      <td className="px-3 py-2 text-xs">
                        {paper.file ? (
                          <span>
                            {formatBytes(paper.file.bytes)}
                            {paper.file.version > 1 ? (
                              <span className="text-muted-foreground">
                                {' '}
                                · v{paper.file.version}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="font-medium text-destructive">Missing</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{rowActions(paper)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {list && list.pageCount > 1 ? (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Page {list.page} of {list.pageCount} · {list.total} papers
              </span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={list.page <= 1}
                  onClick={() => setFilter({ page: list.page - 1 })}
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={list.page >= list.pageCount}
                  onClick={() => setFilter({ page: list.page + 1 })}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CompactCardBody>
      </CompactCard>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit question paper' : 'Add question paper'}</DialogTitle>
            <DialogDescription>
              Pick values from master data so filters stay consistent on the website.
            </DialogDescription>
          </DialogHeader>
          <form
            id="qb-paper-form"
            className="grid grid-cols-1 gap-x-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (fileError) return;
              if (!form.title.trim() && !form.subjectName.trim() && !form.subjectCode.trim()) {
                onMessage('Enter a title or choose a subject.');
                return;
              }
              if (form.status === 'PUBLISHED' && !file && !editing?.file) {
                setFileError('Upload the PDF before publishing.');
                return;
              }
              save.mutate();
            }}
          >
            <ERPField
              className="sm:col-span-2"
              label="Title"
              htmlFor="qb-title"
              helper="Leave blank to use “CODE: Subject name”."
              optional
            >
              <Input
                id="qb-title"
                value={form.title}
                maxLength={200}
                onChange={(event) => updateForm({ title: event.target.value })}
                className="h-9 text-sm"
              />
            </ERPField>
            <ERPField label="Academic year" htmlFor="qb-year">
              <MasterSelect
                id="qb-year"
                value={form.academicYearId}
                onChange={(academicYearId) => updateForm({ academicYearId })}
                options={masters.ACADEMIC_YEAR}
                placeholder="Select academic year"
              />
            </ERPField>
            <ERPField label="Semester" htmlFor="qb-semester">
              <select
                id="qb-semester"
                className={erpSelectClass}
                value={form.semester}
                onChange={(event) => updateForm({ semester: event.target.value })}
              >
                <option value="">Select semester</option>
                {SEMESTERS.map((n) => (
                  <option key={n} value={n}>
                    Semester {n}
                  </option>
                ))}
              </select>
            </ERPField>
            <ERPField label="Programme" htmlFor="qb-programme">
              <MasterSelect
                id="qb-programme"
                value={form.programmeId}
                onChange={(programmeId) => updateForm({ programmeId })}
                options={masters.PROGRAMME}
                placeholder="Select programme"
              />
            </ERPField>
            <ERPField label="Department" htmlFor="qb-department">
              <MasterSelect
                id="qb-department"
                value={form.departmentId}
                onChange={(departmentId) => updateForm({ departmentId })}
                options={masters.DEPARTMENT}
                placeholder="Select department"
              />
            </ERPField>
            <ERPField label="Major" htmlFor="qb-major" optional>
              <MasterSelect
                id="qb-major"
                value={form.majorId}
                onChange={(majorId) => updateForm({ majorId })}
                options={masters.MAJOR}
                placeholder="Select major"
              />
            </ERPField>
            <ERPField label="Examination type" htmlFor="qb-exam-type">
              <MasterSelect
                id="qb-exam-type"
                value={form.examTypeId}
                onChange={(examTypeId) => updateForm({ examTypeId })}
                options={masters.EXAM_TYPE}
                placeholder="Select examination type"
              />
            </ERPField>
            <ERPField
              label="Subject"
              htmlFor="qb-subject"
              helper="Fills subject name and code automatically."
            >
              <MasterSelect
                id="qb-subject"
                value={form.subjectId}
                onChange={onSubjectChange}
                options={
                  form.departmentId
                    ? masters.SUBJECT.filter(
                        (row) =>
                          !row.parentId ||
                          row.parentId === form.departmentId ||
                          row.id === form.subjectId,
                      )
                    : masters.SUBJECT
                }
                placeholder="Select subject"
              />
            </ERPField>
            <ERPField label="Subject code" htmlFor="qb-subject-code">
              <Input
                id="qb-subject-code"
                value={form.subjectCode}
                maxLength={40}
                onChange={(event) => updateForm({ subjectCode: event.target.value.toUpperCase() })}
                className="h-9 font-mono text-sm"
              />
            </ERPField>
            <ERPField className="sm:col-span-2" label="Subject name" htmlFor="qb-subject-name">
              <Input
                id="qb-subject-name"
                value={form.subjectName}
                maxLength={160}
                onChange={(event) => updateForm({ subjectName: event.target.value })}
                className="h-9 text-sm"
              />
            </ERPField>
            <ERPField label="Examination year" htmlFor="qb-exam-year">
              <Input
                id="qb-exam-year"
                type="number"
                min={1990}
                max={2100}
                value={form.examYear}
                onChange={(event) => updateForm({ examYear: event.target.value })}
                className="h-9 text-sm"
              />
            </ERPField>
            <ERPField
              label="Published date"
              htmlFor="qb-published-at"
              helper="Defaults to today when published. Future dates stay hidden until then."
            >
              <Input
                id="qb-published-at"
                type="date"
                value={form.publishedAt}
                onChange={(event) => updateForm({ publishedAt: event.target.value })}
                className="h-9 text-sm"
              />
            </ERPField>
            <ERPField label="Status" htmlFor="qb-status">
              <select
                id="qb-status"
                className={erpSelectClass}
                value={form.status}
                onChange={(event) =>
                  updateForm({ status: event.target.value as QuestionPaperStatus })
                }
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </ERPField>
            <ERPField
              label={editing?.file ? 'Replace PDF' : 'PDF upload'}
              htmlFor="qb-file"
              error={fileError || undefined}
              helper={
                editing?.file
                  ? `Current: ${editing.file.name ?? 'PDF'} (${formatBytes(editing.file.bytes)}, v${editing.file.version}). Max ${maxUploadMb} MB.`
                  : `PDF only, up to ${maxUploadMb} MB.`
              }
            >
              <Input
                id="qb-file"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                className="h-9 text-xs file:mr-2 file:border-0 file:bg-transparent file:text-xs file:font-medium"
              />
            </ERPField>
            <ERPField
              className="sm:col-span-2"
              label="Description"
              htmlFor="qb-description"
              optional
            >
              <textarea
                id="qb-description"
                value={form.description}
                maxLength={4000}
                rows={4}
                onChange={(event) => updateForm({ description: event.target.value })}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </ERPField>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="qb-paper-form" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add question paper'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(viewing)}
        onOpenChange={(open) => (!open ? setViewing(null) : undefined)}
      >
        <DialogContent className="max-w-2xl">
          {viewing ? (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.title}</DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <StatusBadge status={viewing.status} />
                  <span>{viewing.downloadCount} downloads</span>
                </DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {(
                  [
                    ['Subject', viewing.subjectName],
                    ['Subject code', viewing.subjectCode],
                    ['Programme', viewing.programme?.label],
                    ['Department', viewing.department?.label],
                    ['Major', viewing.major?.label],
                    ['Semester', viewing.semester ? `Semester ${viewing.semester}` : null],
                    ['Academic year', viewing.academicYear?.label],
                    ['Examination type', viewing.examType?.label],
                    ['Examination year', viewing.examYear ? String(viewing.examYear) : null],
                    ['Published date', formatQbDate(viewing.publishedAt)],
                    [
                      'PDF',
                      viewing.file
                        ? `${viewing.file.name ?? 'PDF'} · ${formatBytes(viewing.file.bytes)} · v${viewing.file.version}`
                        : 'Not uploaded',
                    ],
                    ['Last updated', formatQbDate(viewing.updatedAt)],
                  ] as Array<[string, string | null | undefined]>
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {label}
                    </dt>
                    <dd>{value || '—'}</dd>
                  </div>
                ))}
              </dl>
              {viewing.description ? (
                <p className="mt-4 whitespace-pre-line rounded-md bg-muted/30 p-3 text-sm">
                  {viewing.description}
                </p>
              ) : null}
              <DialogFooter className="flex-wrap">
                {viewing.status === 'PUBLISHED' ? (
                  <Button type="button" variant="outline" asChild>
                    <a
                      href={collegeSiteUrl(viewing.publicPath)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-1 h-4 w-4" /> Public page
                    </a>
                  </Button>
                ) : null}
                {viewing.file ? (
                  <Button type="button" variant="outline" onClick={() => previewPdf(viewing)}>
                    <FileText className="mr-1 h-4 w-4" /> Preview PDF
                  </Button>
                ) : null}
                <Button
                  type="button"
                  onClick={() => {
                    const paper = viewing;
                    setViewing(null);
                    openEditor(paper);
                  }}
                >
                  <Pencil className="mr-1 h-4 w-4" /> Edit
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
