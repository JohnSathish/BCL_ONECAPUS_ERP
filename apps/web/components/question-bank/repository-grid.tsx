'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Archive,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Globe,
  History,
  Loader2,
  MoreHorizontal,
  Pencil,
  Replace,
  Search,
  Send,
  Share2,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';

import { EditMetadataDialog } from './edit-metadata-dialog';
import { SharePaperDialog } from './share-dialog';
import { StatusBadge } from './qb-shared';
import { VersionsDrawer } from './versions-drawer';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useAuth, useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchAcademicYears, fetchAcademicDepartments } from '@/services/organization';
import { fetchAllPrograms } from '@/services/programs';
import {
  actOnQuestionPaperApproval,
  addPaperVersion,
  addQuestionBookmark,
  archiveQuestionPaper,
  deleteQuestionPaperPermanently,
  downloadQuestionPaper,
  fetchCurriculumCourses,
  fetchQuestionBankUploaders,
  previewQuestionPaperBlob,
  publishQuestionPaper,
  removeQuestionBookmark,
  submitQuestionPaper,
  updateQuestionPaper,
} from '@/services/question-bank';
import type { QuestionPaper, QuestionPaperFilters } from '@/types/question-bank';
import { apiErrorMessage } from '@/utils/api-error';

type Portal = 'admin' | 'staff' | 'student';

type Props = {
  papers: QuestionPaper[];
  filters: QuestionPaperFilters;
  onFiltersChange: (next: QuestionPaperFilters) => void;
  portal: Portal;
  onRefresh: () => void;
  showActions?: boolean;
  showFilters?: boolean;
  title?: string;
  error?: unknown;
};

type Notice = { tone: 'success' | 'error'; text: string };

/** Axios blob errors carry the JSON error body as a Blob; unwrap it for a readable message. */
async function blobErrorMessage(error: unknown, fallback: string) {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text()) as { message?: string | string[] };
      const message = Array.isArray(parsed.message) ? parsed.message[0] : parsed.message;
      if (message) return message;
    } catch {
      /* fall through */
    }
  }
  return apiErrorMessage(error, fallback);
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function PaperPreviewDialog({
  paperId,
  title,
  fileName,
  onClose,
}: {
  paperId: string;
  title: string;
  fileName?: string | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setError(null);
    previewQuestionPaperBlob(paperId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        setUrl(objectUrl);
      })
      .catch(async (err) => {
        if (active) setError(await blobErrorMessage(err, 'Could not load the preview.'));
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [paperId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[90vh] w-full max-w-5xl flex-col rounded-xl border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${title}`}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h3 className="truncate font-semibold">{title}</h3>
          <div className="flex shrink-0 items-center gap-2">
            {url ? (
              <>
                <Button asChild variant="outline" size="sm">
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    Open in new tab
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName ?? 'question-paper.pdf';
                    a.click();
                  }}
                >
                  <Download className="mr-1 h-3.5 w-3.5" /> Download
                </Button>
              </>
            ) : null}
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close preview">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {url ? (
          <iframe title="PDF preview" src={url} className="min-h-0 w-full flex-1" />
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <XCircle className="h-8 w-8 text-destructive" aria-hidden />
            <p className="font-medium">Preview unavailable</p>
            <p className="max-w-md text-sm text-muted-foreground">{error}</p>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading preview…
          </div>
        )}
      </div>
    </div>
  );
}

export function RepositoryGrid({
  papers,
  filters,
  onFiltersChange,
  portal,
  onRefresh,
  showActions = true,
  showFilters = true,
  title = 'Paper Repository',
  error,
}: Props) {
  const queryEnabled = useAuthQueryEnabled();
  const { session } = useAuth();
  const user = session?.user;
  const canManage = user?.permissions?.includes('question-bank:manage');
  const canPublish = user?.permissions?.includes('question-bank:publish') || canManage;
  const canContribute = user?.permissions?.includes('question-bank:contribute') || canManage;
  const canApprove = user?.permissions?.some((p: string) =>
    ['question-bank:approve', 'question-bank:publish', 'question-bank:manage'].includes(p),
  );
  const isStudent = portal === 'student';
  const canOwnerAct = (paper: QuestionPaper) =>
    Boolean(canManage || (paper.uploadedById && paper.uploadedById === user?.id));

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [versionsId, setVersionsId] = useState<string | null>(null);
  const [sharePaper, setSharePaper] = useState<QuestionPaper | null>(null);
  const [editPaper, setEditPaper] = useState<QuestionPaper | null>(null);
  const [courseSearch, setCourseSearch] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<QuestionPaper | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), notice.tone === 'success' ? 5000 : 9000);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(papers.map((p) => p.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [papers]);

  const yearsQuery = useQuery({
    queryKey: ['org', 'academic-years'],
    queryFn: fetchAcademicYears,
    enabled: queryEnabled && showFilters && !isStudent,
  });
  const deptsQuery = useQuery({
    queryKey: ['org', 'academic-departments'],
    queryFn: () => fetchAcademicDepartments(),
    enabled: queryEnabled && showFilters && !isStudent,
  });
  const programsQuery = useQuery({
    queryKey: ['programs', 'all'],
    queryFn: () => fetchAllPrograms(),
    enabled: queryEnabled && showFilters && !isStudent,
  });
  const uploadersQuery = useQuery({
    queryKey: ['question-bank', 'uploaders'],
    queryFn: fetchQuestionBankUploaders,
    enabled: queryEnabled && showFilters && !isStudent,
  });
  const coursesQuery = useQuery({
    queryKey: [
      'question-bank',
      'filter-courses',
      filters.departmentId,
      filters.programVersionId,
      filters.semesterNo,
      courseSearch,
    ],
    queryFn: () =>
      fetchCurriculumCourses({
        departmentId: filters.departmentId || undefined,
        programVersionId: filters.programVersionId || undefined,
        semesterNo: filters.semesterNo ? Number(filters.semesterNo) : undefined,
        q: courseSearch || undefined,
      }),
    enabled: queryEnabled && showFilters && !isStudent,
  });

  const courseOptions = useMemo(() => {
    const rows = coursesQuery.data ?? [];
    if (filters.courseId && !rows.some((c) => c.id === filters.courseId)) {
      const match = papers.find((p) => p.courseId === filters.courseId);
      if (match?.courseId) {
        return [{ id: match.courseId, code: match.paperCode, title: match.paperName }, ...rows];
      }
    }
    return rows;
  }, [coursesQuery.data, filters.courseId, papers]);

  const ok = (text: string) => () => {
    setNotice({ tone: 'success', text });
    onRefresh();
  };
  const fail = (fallback: string) => (err: unknown) =>
    setNotice({ tone: 'error', text: apiErrorMessage(err, fallback) });

  const submitMut = useMutation({
    mutationFn: submitQuestionPaper,
    onSuccess: ok('Paper submitted for review.'),
    onError: fail('Could not submit the paper.'),
  });
  const publishMut = useMutation({
    mutationFn: publishQuestionPaper,
    onSuccess: ok('Paper published.'),
    onError: fail('Could not publish the paper.'),
  });
  const archiveMut = useMutation({
    mutationFn: archiveQuestionPaper,
    onSuccess: ok('Paper archived. It no longer appears for students or on the website.'),
    onError: fail('Could not archive the paper.'),
  });
  const deleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => deleteQuestionPaperPermanently(id)));
      const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      return { deleted: ids.length - failed.length, failed };
    },
    onSuccess: ({ deleted, failed }) => {
      setSelected(new Set());
      onRefresh();
      if (failed.length) {
        setNotice({
          tone: 'error',
          text: `${deleted} deleted, ${failed.length} failed: ${apiErrorMessage(failed[0].reason, 'Delete failed')}`,
        });
      } else {
        setNotice({
          tone: 'success',
          text: `${deleted} paper${deleted === 1 ? '' : 's'} permanently deleted.`,
        });
      }
    },
    onError: fail('Could not delete.'),
  });
  const websiteMut = useMutation({
    mutationFn: ({ id, show }: { id: string; show: boolean }) => {
      const fd = new FormData();
      fd.append('showOnWebsite', String(show));
      return updateQuestionPaper(id, fd);
    },
    onSuccess: (_data, vars) => {
      setNotice({
        tone: 'success',
        text: vars.show
          ? 'Paper is now shown on the college website.'
          : 'Paper hidden from the college website. Students still see it.',
      });
      onRefresh();
    },
    onError: fail('Could not update website visibility.'),
  });
  const bookmarkMut = useMutation({
    mutationFn: addQuestionBookmark,
    onSuccess: onRefresh,
    onError: fail('Could not save the paper.'),
  });
  const unbookmarkMut = useMutation({
    mutationFn: removeQuestionBookmark,
    onSuccess: onRefresh,
    onError: fail('Could not remove the bookmark.'),
  });
  const approveMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      actOnQuestionPaperApproval(id, { action }),
    onSuccess: (_d, vars) =>
      ok(vars.action === 'APPROVE' ? 'Approval recorded.' : 'Paper rejected.')(),
    onError: fail('Could not record the decision.'),
  });
  const replaceMut = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('changeNote', 'Replaced via repository');
      return addPaperVersion(id, fd);
    },
    onSuccess: ok('New PDF uploaded as the latest version.'),
    onError: fail('Could not replace the PDF.'),
  });

  const handleDownload = async (paper: QuestionPaper) => {
    setDownloadingId(paper.id);
    try {
      const blob = await downloadQuestionPaper(paper.id);
      saveBlob(
        new Blob([blob], { type: 'application/pdf' }),
        paper.fileName ?? `${paper.paperCode}.pdf`,
      );
    } catch (err) {
      setNotice({ tone: 'error', text: await blobErrorMessage(err, 'Download failed.') });
    } finally {
      setDownloadingId(null);
    }
  };

  const startReplace = (paper: QuestionPaper) => {
    replaceTargetRef.current = paper;
    replaceInputRef.current?.click();
  };

  const confirmDelete = (targets: QuestionPaper[]) => {
    if (!targets.length) return;
    const label =
      targets.length === 1
        ? `"${targets[0].paperCode} — ${targets[0].paperName}"`
        : `${targets.length} selected papers`;
    if (
      window.confirm(
        `Permanently delete ${label}?\n\nThe PDF files, versions, share links and download history are removed. This cannot be undone.`,
      )
    ) {
      deleteMut.mutate(targets.map((p) => p.id));
    }
  };

  const patch = (partial: Partial<QuestionPaperFilters>) =>
    onFiltersChange({ ...filters, ...partial });

  const selectedPreview = papers.find((p) => p.id === previewId);
  const selectedVersions = papers.find((p) => p.id === versionsId);
  const selectable = showActions && !isStudent && canContribute;
  const deletablePapers = papers.filter(canOwnerAct);
  const allSelected =
    deletablePapers.length > 0 && deletablePapers.every((p) => selected.has(p.id));
  const selectedPapers = papers.filter((p) => selected.has(p.id));

  return (
    <div className="space-y-4">
      {showFilters ? (
        <div className="space-y-3 rounded-xl border p-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search papers…"
                value={filters.q ?? ''}
                onChange={(e) => patch({ q: e.target.value })}
              />
            </div>
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={filters.status ?? ''}
              onChange={(e) => patch({ status: e.target.value })}
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="APPROVED">Approved</option>
              <option value="PUBLISHED">Published</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          {!isStudent ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <select
                className="rounded-md border px-3 py-2 text-sm"
                value={filters.academicYearId ?? ''}
                onChange={(e) => patch({ academicYearId: e.target.value })}
              >
                <option value="">Academic year</option>
                {(yearsQuery.data ?? []).map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Semester"
                type="number"
                value={filters.semesterNo ?? ''}
                onChange={(e) => patch({ semesterNo: e.target.value })}
              />
              <select
                className="rounded-md border px-3 py-2 text-sm"
                value={filters.departmentId ?? ''}
                onChange={(e) => patch({ departmentId: e.target.value })}
              >
                <option value="">Department</option>
                {(deptsQuery.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border px-3 py-2 text-sm"
                value={filters.programVersionId ?? ''}
                onChange={(e) => patch({ programVersionId: e.target.value })}
              >
                <option value="">Programme version</option>
                {(programsQuery.data?.data ?? []).flatMap((p) =>
                  (p.versions ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {p.code} v{v.version}
                    </option>
                  )),
                )}
              </select>
              <select
                className="rounded-md border px-3 py-2 text-sm"
                value={filters.paperType ?? ''}
                onChange={(e) => patch({ paperType: e.target.value })}
              >
                <option value="">Paper type</option>
                <option value="THEORY">Theory</option>
                <option value="PRACTICAL">Practical</option>
                <option value="THEORY_PRACTICAL">Theory + Practical</option>
              </select>
              <Input
                placeholder="Exam year"
                type="number"
                value={filters.examYear ?? ''}
                onChange={(e) => patch({ examYear: e.target.value })}
              />
              <select
                className="rounded-md border px-3 py-2 text-sm"
                value={filters.language ?? ''}
                onChange={(e) => patch({ language: e.target.value })}
              >
                <option value="">Language</option>
                <option value="EN">EN</option>
                <option value="HI">HI</option>
                <option value="GARO">GARO</option>
                <option value="KHASI">KHASI</option>
                <option value="BILINGUAL">BILINGUAL</option>
              </select>
              <div className="space-y-1 sm:col-span-2">
                <Input
                  placeholder="Search course / subject…"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                />
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={filters.courseId ?? ''}
                  onChange={(e) => patch({ courseId: e.target.value })}
                >
                  <option value="">All courses</option>
                  {courseOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <select
                className="rounded-md border px-3 py-2 text-sm"
                value={filters.uploadedById ?? ''}
                onChange={(e) => patch({ uploadedById: e.target.value })}
              >
                <option value="">Uploaded by</option>
                {(uploadersQuery.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        {selectable && selectedPapers.length ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{selectedPapers.length} selected</span>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMut.isPending}
              onClick={() => confirmDelete(selectedPapers)}
            >
              {deleteMut.isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-3.5 w-3.5" />
              )}
              Delete selected
            </Button>
          </div>
        ) : null}
      </div>

      {notice ? (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
            notice.tone === 'error'
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          {notice.tone === 'error' ? (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          )}
          <span className="flex-1">{notice.text}</span>
          <button
            type="button"
            className="opacity-70 hover:opacity-100"
            onClick={() => setNotice(null)}
            aria-label="Dismiss message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {!papers.length ? (
        <p className="text-sm text-muted-foreground">No papers found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                {selectable ? (
                  <th className="w-8 px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      aria-label="Select all papers"
                      checked={allSelected}
                      disabled={!deletablePapers.length}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? new Set(deletablePapers.map((p) => p.id)) : new Set(),
                        )
                      }
                    />
                  </th>
                ) : null}
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Dept / Programme</th>
                <th className="px-3 py-2">Sem</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Year</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Downloads</th>
                <th className="px-3 py-2">Uploader</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {papers.map((paper) => {
                const ownerAct = canOwnerAct(paper);
                const pendingApproval = paper.approvals?.find((a) => a.status === 'PENDING');
                const canPublishThis =
                  canPublish &&
                  ['APPROVED', 'PENDING_REVIEW', 'DRAFT', 'REJECTED'].includes(paper.status);
                const busyRow =
                  (deleteMut.isPending && deleteMut.variables?.includes(paper.id)) ||
                  (archiveMut.isPending && archiveMut.variables === paper.id) ||
                  (replaceMut.isPending && replaceMut.variables?.id === paper.id) ||
                  (websiteMut.isPending && websiteMut.variables?.id === paper.id);
                return (
                  <tr
                    key={paper.id}
                    className={`border-t align-top ${selected.has(paper.id) ? 'bg-primary/5' : ''} ${busyRow ? 'opacity-60' : ''}`}
                  >
                    {selectable ? (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          aria-label={`Select ${paper.paperCode}`}
                          disabled={!ownerAct}
                          checked={selected.has(paper.id)}
                          onChange={(e) =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(paper.id);
                              else next.delete(paper.id);
                              return next;
                            })
                          }
                        />
                      </td>
                    ) : null}
                    <td className="px-3 py-2 font-medium">{paper.paperCode}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() => setPreviewId(paper.id)}
                      >
                        {paper.paperName}
                      </button>
                      {paper.currentVersionNo && paper.currentVersionNo > 1 ? (
                        <p className="text-xs text-muted-foreground">v{paper.currentVersionNo}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div>{paper.departmentName ?? '—'}</div>
                      <div className="text-muted-foreground">{paper.programmeName ?? ''}</div>
                    </td>
                    <td className="px-3 py-2">{paper.semesterNo ?? '—'}</td>
                    <td className="px-3 py-2">{paper.paperType}</td>
                    <td className="px-3 py-2">{paper.examYear ?? '—'}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={paper.status} />
                      {paper.status === 'PUBLISHED' && !isStudent ? (
                        <p
                          className={`mt-1 flex items-center gap-1 text-[11px] ${
                            paper.showOnWebsite === false
                              ? 'text-muted-foreground'
                              : 'text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {paper.showOnWebsite === false ? (
                            <>
                              <EyeOff className="h-3 w-3" aria-hidden /> Not on website
                            </>
                          ) : (
                            <>
                              <Globe className="h-3 w-3" aria-hidden /> On website
                            </>
                          )}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{paper.downloadCount ?? 0}</td>
                    <td className="px-3 py-2 text-xs">{paper.uploadedByName ?? '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 px-2"
                          onClick={() => setPreviewId(paper.id)}
                          title="Preview PDF"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => void handleDownload(paper)}
                          disabled={downloadingId === paper.id}
                          title="Download PDF"
                          aria-label={`Download ${paper.paperCode}`}
                        >
                          {downloadingId === paper.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        {isStudent ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title={paper.bookmarkId ? 'Remove bookmark' : 'Bookmark'}
                            onClick={() =>
                              paper.bookmarkId
                                ? unbookmarkMut.mutate(paper.id)
                                : bookmarkMut.mutate(paper.id)
                            }
                          >
                            {paper.bookmarkId ? (
                              <BookmarkCheck className="h-3.5 w-3.5" />
                            ) : (
                              <Bookmark className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        ) : null}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                              aria-label={`More actions for ${paper.paperCode}`}
                              title="More actions"
                            >
                              {busyRow ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-60">
                            <DropdownMenuLabel className="truncate">
                              {paper.paperCode} — {paper.paperName}
                            </DropdownMenuLabel>
                            <DropdownMenuItem onSelect={() => setVersionsId(paper.id)}>
                              <History className="mr-2 h-4 w-4" /> Version history
                            </DropdownMenuItem>
                            {showActions && canContribute ? (
                              <>
                                {ownerAct ? (
                                  <DropdownMenuItem onSelect={() => setEditPaper(paper)}>
                                    <Pencil className="mr-2 h-4 w-4" /> Edit details
                                  </DropdownMenuItem>
                                ) : null}
                                {ownerAct ? (
                                  <DropdownMenuItem onSelect={() => startReplace(paper)}>
                                    <Replace className="mr-2 h-4 w-4" /> Replace PDF
                                  </DropdownMenuItem>
                                ) : null}
                                {paper.status === 'PUBLISHED' && ownerAct ? (
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      websiteMut.mutate({
                                        id: paper.id,
                                        show: paper.showOnWebsite === false,
                                      })
                                    }
                                  >
                                    {paper.showOnWebsite === false ? (
                                      <>
                                        <Globe className="mr-2 h-4 w-4" /> Show on website
                                      </>
                                    ) : (
                                      <>
                                        <EyeOff className="mr-2 h-4 w-4" /> Hide from website
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                ) : null}
                                {paper.status === 'PUBLISHED' || canManage ? (
                                  <DropdownMenuItem onSelect={() => setSharePaper(paper)}>
                                    <Share2 className="mr-2 h-4 w-4" /> Share link
                                  </DropdownMenuItem>
                                ) : null}
                              </>
                            ) : null}
                            {showActions && canContribute && paper.status === 'DRAFT' ? (
                              <DropdownMenuItem onSelect={() => submitMut.mutate(paper.id)}>
                                <Send className="mr-2 h-4 w-4" /> Submit for review
                              </DropdownMenuItem>
                            ) : null}
                            {showActions && canPublishThis ? (
                              <DropdownMenuItem onSelect={() => publishMut.mutate(paper.id)}>
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Publish now
                              </DropdownMenuItem>
                            ) : null}
                            {showActions && canApprove && pendingApproval ? (
                              <>
                                <DropdownMenuItem
                                  onSelect={() =>
                                    approveMut.mutate({ id: pendingApproval.id, action: 'APPROVE' })
                                  }
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() =>
                                    approveMut.mutate({ id: pendingApproval.id, action: 'REJECT' })
                                  }
                                >
                                  <XCircle className="mr-2 h-4 w-4" /> Reject
                                </DropdownMenuItem>
                              </>
                            ) : null}
                            {showActions && ownerAct && !isStudent ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={() => {
                                    if (
                                      window.confirm(
                                        `Archive "${paper.paperCode} — ${paper.paperName}"? It will disappear from the website, student dashboard and app, but the file is kept.`,
                                      )
                                    ) {
                                      archiveMut.mutate(paper.id);
                                    }
                                  }}
                                >
                                  <Archive className="mr-2 h-4 w-4" /> Archive (hide)
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                  onSelect={() => confirmDelete([paper])}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete permanently
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <input
        ref={replaceInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const target = replaceTargetRef.current;
          e.target.value = '';
          if (!file || !target) return;
          if (file.type && file.type !== 'application/pdf') {
            setNotice({ tone: 'error', text: 'Please choose a PDF file.' });
            return;
          }
          replaceMut.mutate({ id: target.id, file });
        }}
      />

      {error ? <p className="text-sm text-destructive">{apiErrorMessage(error)}</p> : null}

      {previewId && selectedPreview ? (
        <PaperPreviewDialog
          paperId={previewId}
          title={`${selectedPreview.paperCode} — ${selectedPreview.paperName}`}
          fileName={selectedPreview.fileName}
          onClose={() => setPreviewId(null)}
        />
      ) : null}
      {versionsId && selectedVersions ? (
        <VersionsDrawer
          paperId={versionsId}
          paperLabel={`${selectedVersions.paperCode} — ${selectedVersions.paperName}`}
          onClose={() => setVersionsId(null)}
        />
      ) : null}
      {sharePaper ? (
        <SharePaperDialog
          paperId={sharePaper.id}
          paperLabel={`${sharePaper.paperCode} — ${sharePaper.paperName}`}
          onClose={() => setSharePaper(null)}
        />
      ) : null}
      {editPaper ? (
        <EditMetadataDialog
          paper={editPaper}
          onClose={() => setEditPaper(null)}
          onSaved={() => {
            setNotice({ tone: 'success', text: 'Paper details saved.' });
            onRefresh();
          }}
        />
      ) : null}
    </div>
  );
}
