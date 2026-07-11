'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Archive,
  Bookmark,
  BookmarkCheck,
  Download,
  Eye,
  History,
  Pencil,
  Replace,
  Search,
  Send,
  Share2,
} from 'lucide-react';

import { EditMetadataDialog } from './edit-metadata-dialog';
import { SharePaperDialog } from './share-dialog';
import { StatusBadge } from './qb-shared';
import { VersionsDrawer } from './versions-drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchAcademicYears, fetchAcademicDepartments } from '@/services/organization';
import { fetchAllPrograms } from '@/services/programs';
import {
  actOnQuestionPaperApproval,
  addPaperVersion,
  addQuestionBookmark,
  archiveQuestionPaper,
  downloadQuestionPaper,
  fetchCurriculumCourses,
  fetchQuestionBankUploaders,
  previewQuestionPaperBlob,
  publishQuestionPaper,
  removeQuestionBookmark,
  submitQuestionPaper,
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

function PaperPreviewDialog({
  paperId,
  title,
  onClose,
}: {
  paperId: string;
  title: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    previewQuestionPaperBlob(paperId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [paperId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[90vh] w-full max-w-4xl flex-col rounded-xl border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        {url ? (
          <iframe title="PDF preview" src={url} className="min-h-0 flex-1 w-full" />
        ) : (
          <p className="p-6 text-sm text-muted-foreground">Loading preview…</p>
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

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [versionsId, setVersionsId] = useState<string | null>(null);
  const [sharePaper, setSharePaper] = useState<QuestionPaper | null>(null);
  const [editPaper, setEditPaper] = useState<QuestionPaper | null>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [courseSearch, setCourseSearch] = useState('');

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
      const selected = papers.find((p) => p.courseId === filters.courseId);
      if (selected?.courseId) {
        return [
          {
            id: selected.courseId,
            code: selected.paperCode,
            title: selected.paperName,
          },
          ...rows,
        ];
      }
    }
    return rows;
  }, [coursesQuery.data, filters.courseId, papers]);

  const submitMut = useMutation({ mutationFn: submitQuestionPaper, onSuccess: onRefresh });
  const publishMut = useMutation({ mutationFn: publishQuestionPaper, onSuccess: onRefresh });
  const archiveMut = useMutation({ mutationFn: archiveQuestionPaper, onSuccess: onRefresh });
  const bookmarkMut = useMutation({ mutationFn: addQuestionBookmark, onSuccess: onRefresh });
  const unbookmarkMut = useMutation({ mutationFn: removeQuestionBookmark, onSuccess: onRefresh });
  const approveMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      actOnQuestionPaperApproval(id, { action }),
    onSuccess: onRefresh,
  });
  const replaceMut = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('changeNote', 'Replaced via repository');
      return addPaperVersion(id, fd);
    },
    onSuccess: () => {
      setReplaceId(null);
      onRefresh();
    },
  });

  const handleDownload = async (id: string, fileName?: string | null) => {
    const blob = await downloadQuestionPaper(id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName ?? 'question-paper.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  const patch = (partial: Partial<QuestionPaperFilters>) =>
    onFiltersChange({ ...filters, ...partial });

  const selectedPreview = papers.find((p) => p.id === previewId);
  const selectedVersions = papers.find((p) => p.id === versionsId);

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

      <h3 className="font-semibold">{title}</h3>

      {!papers.length ? (
        <p className="text-sm text-muted-foreground">No papers found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Dept / Programme</th>
                <th className="px-3 py-2">Sem</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Year</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Downloads</th>
                <th className="px-3 py-2">Uploader</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {papers.map((paper) => (
                <tr key={paper.id} className="border-t align-top">
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
                  </td>
                  <td className="px-3 py-2">{paper.downloadCount ?? 0}</td>
                  <td className="px-3 py-2 text-xs">{paper.uploadedByName ?? '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex max-w-[280px] flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPreviewId(paper.id)}
                        title="Preview"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(paper.id, paper.fileName)}
                        title="Download"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setVersionsId(paper.id)}
                        title="Versions"
                      >
                        <History className="h-3 w-3" />
                      </Button>
                      {isStudent ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            paper.bookmarkId
                              ? unbookmarkMut.mutate(paper.id)
                              : bookmarkMut.mutate(paper.id)
                          }
                        >
                          {paper.bookmarkId ? (
                            <BookmarkCheck className="h-3 w-3" />
                          ) : (
                            <Bookmark className="h-3 w-3" />
                          )}
                        </Button>
                      ) : null}
                      {showActions && canContribute ? (
                        <>
                          {canManage ||
                          (paper.uploadedById === user?.id &&
                            ['DRAFT', 'REJECTED'].includes(paper.status)) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              title="Edit metadata"
                              onClick={() => setEditPaper(paper)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            title="Replace (new version)"
                            onClick={() => setReplaceId(paper.id)}
                          >
                            <Replace className="h-3 w-3" />
                          </Button>
                          {paper.status === 'PUBLISHED' || canManage ? (
                            <Button
                              size="sm"
                              variant="outline"
                              title="Share"
                              onClick={() => setSharePaper(paper)}
                            >
                              <Share2 className="h-3 w-3" />
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                      {showActions && canContribute && paper.status === 'DRAFT' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => submitMut.mutate(paper.id)}
                        >
                          <Send className="mr-1 h-3 w-3" /> Submit
                        </Button>
                      ) : null}
                      {showActions &&
                      canPublish &&
                      ['APPROVED', 'PENDING_REVIEW'].includes(paper.status) ? (
                        <Button size="sm" onClick={() => publishMut.mutate(paper.id)}>
                          Publish
                        </Button>
                      ) : null}
                      {showActions &&
                      canApprove &&
                      paper.approvals?.some((a) => a.status === 'PENDING') ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => {
                              const pending = paper.approvals?.find((a) => a.status === 'PENDING');
                              if (pending) approveMut.mutate({ id: pending.id, action: 'APPROVE' });
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const pending = paper.approvals?.find((a) => a.status === 'PENDING');
                              if (pending) approveMut.mutate({ id: pending.id, action: 'REJECT' });
                            }}
                          >
                            Reject
                          </Button>
                        </>
                      ) : null}
                      {showActions && (canManage || (canContribute && paper.status === 'DRAFT')) ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => archiveMut.mutate(paper.id)}
                        >
                          <Archive className="h-3 w-3" />
                        </Button>
                      ) : null}
                    </div>
                    {replaceId === paper.id ? (
                      <Input
                        className="mt-2"
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) replaceMut.mutate({ id: paper.id, file: f });
                        }}
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error ? <p className="text-sm text-destructive">{apiErrorMessage(error)}</p> : null}
      {replaceMut.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(replaceMut.error)}</p>
      ) : null}

      {previewId && selectedPreview ? (
        <PaperPreviewDialog
          paperId={previewId}
          title={`${selectedPreview.paperCode} — ${selectedPreview.paperName}`}
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
          onSaved={onRefresh}
        />
      ) : null}
    </div>
  );
}
