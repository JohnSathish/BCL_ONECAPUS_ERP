'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Bookmark,
  BookOpen,
  Bot,
  Download,
  Eye,
  FileText,
  History,
  Search,
  Send,
  ShieldCheck,
  Upload,
} from 'lucide-react';

import { SimpleBarChart, StatusBadge, formatBytes } from '@/components/question-bank/qb-shared';
import { SyllabusUploadWizard } from '@/components/syllabus-repository/syllabus-upload-wizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  actOnSyllabusApproval,
  addSyllabusVersion,
  archiveSyllabusDocument,
  askSyllabusDocument,
  downloadSyllabusDocument,
  fetchMySyllabusBookmarks,
  fetchMySyllabusDocuments,
  fetchPendingSyllabusApprovals,
  fetchSyllabusDashboard,
  fetchSyllabusDocuments,
  fetchSyllabusSettings,
  fetchSyllabusVersions,
  previewSyllabusDocument,
  publishSyllabusDocument,
  submitSyllabusDocument,
  toggleSyllabusBookmark,
  updateSyllabusSettings,
} from '@/services/syllabus-repository';
import type {
  AskSyllabusResponse,
  SyllabusApproval,
  SyllabusDocument,
  SyllabusFilters,
} from '@/types/syllabus-repository';
import { apiErrorMessage } from '@/utils/api-error';

type Page = 'dashboard' | 'documents' | 'upload' | 'workflow' | 'settings' | 'student';
type Portal = 'admin' | 'staff' | 'student';

type Props = {
  page?: Page;
  portal?: Portal;
};
function patchParams(filters: SyllabusFilters) {
  return {
    q: filters.q || undefined,
    status: filters.status || undefined,
    academicYearId: filters.academicYearId || undefined,
    semesterNo: filters.semesterNo ? Number(filters.semesterNo) : undefined,
    programVersionId: filters.programVersionId || undefined,
    departmentId: filters.departmentId || undefined,
    courseId: filters.courseId || undefined,
    category: filters.category || undefined,
    subjectType: filters.subjectType || undefined,
    uploadedById: filters.uploadedById || undefined,
    limit: 50,
  };
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function groupDocuments(documents: SyllabusDocument[]) {
  return documents.reduce<Record<string, SyllabusDocument[]>>((acc, doc) => {
    const key = [doc.category || 'Uncategorized', doc.subjectType || 'General'].join(' / ');
    acc[key] = [...(acc[key] ?? []), doc];
    return acc;
  }, {});
}

function SyllabusDashboardPanel({
  data,
  error,
}: {
  data?: Awaited<ReturnType<typeof fetchSyllabusDashboard>>;
  error?: unknown;
}) {
  const kpis = data?.kpis;
  const errText = error ? apiErrorMessage(error) : '';
  const needsMigration = /syllabus_|tables are missing|vps-migrate/i.test(errText);

  const cards = [
    {
      label: 'Total Syllabi',
      value: kpis?.totalDocuments ?? (error ? '—' : 0),
      hint: 'All uploaded documents',
      icon: FileText,
      tone: 'from-sky-500/15 to-sky-500/5 text-sky-700',
    },
    {
      label: 'Published',
      value: kpis?.publishedDocuments ?? (error ? '—' : 0),
      hint: 'Visible to students',
      icon: BookOpen,
      tone: 'from-emerald-500/15 to-emerald-500/5 text-emerald-700',
    },
    {
      label: 'Pending Approval',
      value: kpis?.pendingApprovals ?? kpis?.pendingDocuments ?? (error ? '—' : 0),
      hint: 'Awaiting HOD / admin',
      icon: ShieldCheck,
      tone: 'from-amber-500/15 to-amber-500/5 text-amber-800',
    },
    {
      label: 'Downloads',
      value: kpis?.downloadsThisMonth ?? (error ? '—' : 0),
      hint: `${formatBytes(kpis?.storageUsedBytes)} stored`,
      icon: Download,
      tone: 'from-violet-500/15 to-violet-500/5 text-violet-700',
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 p-6 text-white shadow-sm">
        <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-sky-400/20 blur-2xl" />
        <div className="absolute -bottom-12 right-16 h-36 w-36 rounded-full bg-emerald-400/10 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/90">
              Academic Knowledge Hub
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">Syllabus Repository</h2>
            <p className="text-sm text-slate-200/90">
              Version-controlled programme and paper syllabi linked to Course Master — with student
              auto-filtering, PDF preview, and Ask AI on publish.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
              PDF + metadata
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
              Version history
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
              AI-ready
            </span>
          </div>
        </div>
      </div>

      {needsMigration ? (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold">Database migration required</p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
            Syllabus tables are not on this database yet. On the VPS run:
          </p>
          <code className="mt-2 block rounded-lg bg-amber-100/80 px-3 py-2 text-xs dark:bg-black/30">
            cd /opt/nep-erp && bash scripts/deploy/vps-migrate.sh
          </code>
          <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-200/80">
            Then recreate/restart the API container so Prisma Client picks up the new schema.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`rounded-2xl border border-border/60 bg-gradient-to-br ${card.tone} p-4 shadow-sm`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide opacity-70">
                    {card.label}
                  </p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                    {card.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
                </div>
                <span className="rounded-xl bg-background/70 p-2 shadow-sm">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SimpleBarChart title="Status Mix" items={data?.statusMix ?? []} />
        <SimpleBarChart title="By Category" items={data?.documentsByCategory ?? []} />
        <SimpleBarChart title="By Department" items={data?.documentsByDepartment ?? []} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-sm font-semibold">Coverage snapshot</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Missing papers vs active course offerings
          </p>
          <div className="mt-4 flex items-end gap-6">
            <div>
              <p className="text-3xl font-semibold">{kpis?.missingCourses ?? (error ? '—' : 0)}</p>
              <p className="text-xs text-muted-foreground">Courses without published syllabus</p>
            </div>
            {kpis?.topDocument ? (
              <div className="min-w-0 flex-1 rounded-xl bg-muted/40 px-3 py-2">
                <p className="text-xs text-muted-foreground">Most downloaded</p>
                <p className="truncate font-medium">
                  {kpis.topDocument.paperCode} — {kpis.topDocument.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {kpis.topDocument.downloads} downloads
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Upload and publish syllabi to populate insights.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-sm font-semibold">Quick actions</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" /> Upload by paper code — metadata auto-fills
            </li>
            <li className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Replace PDF creates a new version (never
              overwrite)
            </li>
            <li className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" /> Publish indexes the PDF for Ask AI
            </li>
          </ul>
        </div>
      </div>

      {error && !needsMigration ? <p className="text-sm text-destructive">{errText}</p> : null}
    </div>
  );
}

function SyllabusDetailModal({
  document,
  canContribute,
  onClose,
  onRefresh,
}: {
  document: SyllabusDocument;
  canContribute: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const queryEnabled = useAuthQueryEnabled();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState<{ question: string; response: AskSyllabusResponse }[]>([]);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    previewSyllabusDocument(document.id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => setPreviewUrl(null));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document.id]);

  const versionsQuery = useQuery({
    queryKey: ['syllabus-repository', 'versions', document.id],
    queryFn: () => fetchSyllabusVersions(document.id),
    enabled: queryEnabled,
  });

  const askMut = useMutation({
    mutationFn: () => askSyllabusDocument(document.id, question),
    onSuccess: (response) => {
      setAnswers((prev) => [...prev, { question, response }]);
      setQuestion('');
    },
  });

  const versionMut = useMutation({
    mutationFn: async () => {
      if (!replaceFile) throw new Error('Choose a PDF file');
      const fd = new FormData();
      fd.append('file', replaceFile);
      fd.append('changeNote', 'Uploaded from syllabus workspace');
      return addSyllabusVersion(document.id, fd);
    },
    onSuccess: () => {
      setReplaceFile(null);
      onRefresh();
      versionsQuery.refetch();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[92vh] w-full max-w-6xl flex-col rounded-xl border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <h3 className="font-semibold">
              {document.paperCode} - {document.title}
            </h3>
            <p className="text-xs text-muted-foreground">
              {document.departmentName ?? 'Department not set'} - Semester{' '}
              {document.semesterNo ?? '-'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-h-[500px] overflow-hidden rounded-lg border bg-muted/30">
            {previewUrl ? (
              <iframe
                title="Syllabus PDF preview"
                src={previewUrl}
                className="h-full min-h-[500px] w-full"
              />
            ) : (
              <p className="p-6 text-sm text-muted-foreground">Loading preview...</p>
            )}
          </div>
          <div className="space-y-4">
            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <History className="h-4 w-4" /> Versions
              </h4>
              {!versionsQuery.data?.length ? (
                <p className="text-sm text-muted-foreground">No versions found.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {versionsQuery.data.map((version) => (
                    <li key={version.id} className="rounded-lg border p-2">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">v{version.versionNo}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(version.fileSizeBytes)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {version.fileName ?? version.changeNote ?? 'Syllabus PDF'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {canContribute ? (
                <div className="mt-3 space-y-2">
                  <Input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setReplaceFile(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    size="sm"
                    disabled={!replaceFile || versionMut.isPending}
                    onClick={() => versionMut.mutate()}
                  >
                    Add Version
                  </Button>
                </div>
              ) : null}
              {versionMut.isError ? (
                <p className="mt-2 text-sm text-destructive">{apiErrorMessage(versionMut.error)}</p>
              ) : null}
            </section>
            <section className="rounded-xl border bg-card p-4 shadow-sm">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Bot className="h-4 w-4" /> Ask AI
              </h4>
              <div className="space-y-3">
                {answers.map((item, index) => (
                  <div
                    key={`${item.question}-${index}`}
                    className="rounded-lg bg-muted/50 p-3 text-sm"
                  >
                    <p className="font-medium">Q: {item.question}</p>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                      {item.response.answer}
                    </p>
                  </div>
                ))}
                <textarea
                  className="min-h-[90px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="Ask about outcomes, units, readings, or assessment..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                <Button
                  disabled={!question.trim() || askMut.isPending}
                  onClick={() => askMut.mutate()}
                >
                  {askMut.isPending ? 'Asking...' : 'Ask'}
                </Button>
                {askMut.isError ? (
                  <p className="text-sm text-destructive">{apiErrorMessage(askMut.error)}</p>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentsGrid({
  documents,
  filters,
  onFiltersChange,
  portal,
  canContribute,
  canManage,
  canPublish,
  error,
  title = 'Syllabus Repository',
  showFilters = true,
  onRefresh,
}: {
  documents: SyllabusDocument[];
  filters: SyllabusFilters;
  onFiltersChange: (next: SyllabusFilters) => void;
  portal: Portal;
  canContribute: boolean;
  canManage: boolean;
  canPublish: boolean;
  error?: unknown;
  title?: string;
  showFilters?: boolean;
  onRefresh: () => void;
}) {
  const [detail, setDetail] = useState<SyllabusDocument | null>(null);
  const isStudent = portal === 'student';

  const submitMut = useMutation({ mutationFn: submitSyllabusDocument, onSuccess: onRefresh });
  const publishMut = useMutation({ mutationFn: publishSyllabusDocument, onSuccess: onRefresh });
  const archiveMut = useMutation({ mutationFn: archiveSyllabusDocument, onSuccess: onRefresh });
  const bookmarkMut = useMutation({ mutationFn: toggleSyllabusBookmark, onSuccess: onRefresh });

  const patch = (partial: Partial<SyllabusFilters>) => onFiltersChange({ ...filters, ...partial });

  const handleDownload = async (doc: SyllabusDocument) => {
    const blob = await downloadSyllabusDocument(doc.id);
    downloadBlob(blob, doc.fileName ?? `${doc.paperCode || 'syllabus'}.pdf`);
  };

  return (
    <div className="space-y-4">
      {showFilters ? (
        <div className="space-y-3 rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search syllabus documents..."
                value={filters.q ?? ''}
                onChange={(e) => patch({ q: e.target.value })}
              />
            </div>
            {!isStudent ? (
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm"
                value={filters.status ?? ''}
                onChange={(e) => patch({ status: e.target.value })}
              >
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PENDING_REVIEW">Pending Review</option>
                <option value="APPROVED">Approved</option>
                <option value="PUBLISHED">Published</option>
                <option value="REJECTED">Rejected</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            ) : null}
          </div>
          {!isStudent ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                placeholder="Semester"
                type="number"
                value={filters.semesterNo ?? ''}
                onChange={(e) => patch({ semesterNo: e.target.value })}
              />
              <Input
                placeholder="Category"
                value={filters.category ?? ''}
                onChange={(e) => patch({ category: e.target.value })}
              />
              <Input
                placeholder="Subject type"
                value={filters.subjectType ?? ''}
                onChange={(e) => patch({ subjectType: e.target.value })}
              />
              <Button variant="outline" onClick={() => onFiltersChange({})}>
                Clear Filters
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <h3 className="font-semibold">{title}</h3>
      {!documents.length ? (
        <p className="text-sm text-muted-foreground">No syllabus documents found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Department</th>
                <th className="px-3 py-2">Sem</th>
                <th className="px-3 py-2">Credits</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-t align-top">
                  <td className="px-3 py-2 font-medium">{doc.paperCode}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-left hover:underline"
                      onClick={() => setDetail(doc)}
                    >
                      {doc.title}
                    </button>
                    {doc.currentVersionNo && doc.currentVersionNo > 1 ? (
                      <p className="text-xs text-muted-foreground">v{doc.currentVersionNo}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div>{doc.category ?? '-'}</div>
                    <div className="text-muted-foreground">{doc.subjectType ?? ''}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{doc.departmentName ?? '-'}</td>
                  <td className="px-3 py-2">{doc.semesterNo ?? '-'}</td>
                  <td className="px-3 py-2">{String(doc.credits ?? '-')}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={doc.status} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex max-w-[280px] flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDetail(doc)}
                        title="View"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(doc)}
                        title="Download"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                      {isStudent ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => bookmarkMut.mutate(doc.id)}
                          title="Bookmark"
                        >
                          <Bookmark className="h-3 w-3" />
                        </Button>
                      ) : null}
                      {!isStudent && canContribute && doc.status === 'DRAFT' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => submitMut.mutate(doc.id)}
                        >
                          <Send className="mr-1 h-3 w-3" /> Submit
                        </Button>
                      ) : null}
                      {!isStudent &&
                      canPublish &&
                      ['APPROVED', 'PENDING_REVIEW'].includes(doc.status) ? (
                        <Button size="sm" onClick={() => publishMut.mutate(doc.id)}>
                          Publish
                        </Button>
                      ) : null}
                      {!isStudent && canManage ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => archiveMut.mutate(doc.id)}
                          title="Archive"
                        >
                          <Archive className="h-3 w-3" />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error ? <p className="text-sm text-destructive">{apiErrorMessage(error)}</p> : null}
      {detail ? (
        <SyllabusDetailModal
          document={detail}
          canContribute={canContribute}
          onClose={() => setDetail(null)}
          onRefresh={onRefresh}
        />
      ) : null}
    </div>
  );
}

function WorkflowPanel({
  approvals,
  documents,
  canManage,
  error,
  onRefresh,
}: {
  approvals: SyllabusApproval[];
  documents: SyllabusDocument[];
  canManage: boolean;
  error?: unknown;
  onRefresh: () => void;
}) {
  const approvalMut = useMutation({
    mutationFn: ({
      id,
      action,
      comments,
    }: {
      id: string;
      action: 'APPROVE' | 'REJECT';
      comments?: string;
    }) => actOnSyllabusApproval(id, { action, comments }),
    onSuccess: onRefresh,
  });
  const publishMut = useMutation({ mutationFn: publishSyllabusDocument, onSuccess: onRefresh });

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4" /> Approval Queue
        </h3>
        {!approvals.length ? (
          <p className="text-sm text-muted-foreground">No pending approvals.</p>
        ) : null}
        {approvals.map((approval) => (
          <div
            key={approval.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3 shadow-sm"
          >
            <div>
              <p className="font-medium">{approval.document?.title ?? approval.documentId}</p>
              <p className="text-xs text-muted-foreground">
                {approval.stepName} - {approval.roleSlug ?? 'workflow'}
              </p>
              {approval.document?.status ? <StatusBadge status={approval.document.status} /> : null}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => approvalMut.mutate({ id: approval.id, action: 'APPROVE' })}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  approvalMut.mutate({ id: approval.id, action: 'REJECT', comments: 'Rejected' })
                }
              >
                Reject
              </Button>
            </div>
          </div>
        ))}
      </section>
      {canManage ? (
        <section className="space-y-4">
          <h3 className="font-semibold">Ready to Publish</h3>
          {!documents.length ? (
            <p className="text-sm text-muted-foreground">
              No approved documents waiting to publish.
            </p>
          ) : null}
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3 shadow-sm"
            >
              <div>
                <p className="font-medium">
                  {doc.paperCode} - {doc.title}
                </p>
                <StatusBadge status={doc.status} />
              </div>
              <Button size="sm" onClick={() => publishMut.mutate(doc.id)}>
                Publish
              </Button>
            </div>
          ))}
        </section>
      ) : null}
      {error ? <p className="text-sm text-destructive">{apiErrorMessage(error)}</p> : null}
      {approvalMut.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(approvalMut.error)}</p>
      ) : null}
      {publishMut.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(publishMut.error)}</p>
      ) : null}
    </div>
  );
}

function SettingsPanel({ onSaved }: { onSaved: () => void }) {
  const queryEnabled = useAuthQueryEnabled();
  const [form, setForm] = useState({ maxUploadMb: 20, studentAccessEnabled: true });
  const settingsQuery = useQuery({
    queryKey: ['syllabus-repository', 'settings'],
    queryFn: fetchSyllabusSettings,
    enabled: queryEnabled,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setForm({
        maxUploadMb: settingsQuery.data.maxUploadMb,
        studentAccessEnabled: settingsQuery.data.studentAccessEnabled,
      });
    }
  }, [settingsQuery.data]);

  const saveMut = useMutation({
    mutationFn: () => updateSyllabusSettings(form),
    onSuccess: onSaved,
  });

  return (
    <div className="max-w-md space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="font-semibold">Repository Settings</h3>
      <label className="block space-y-1 text-sm">
        <span>Max upload (MB)</span>
        <Input
          type="number"
          min={1}
          value={form.maxUploadMb}
          onChange={(e) => setForm({ ...form, maxUploadMb: Number(e.target.value) })}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.studentAccessEnabled}
          onChange={(e) => setForm({ ...form, studentAccessEnabled: e.target.checked })}
        />
        Student access enabled
      </label>
      <Button disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
        Save
      </Button>
      {settingsQuery.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(settingsQuery.error)}</p>
      ) : null}
      {saveMut.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(saveMut.error)}</p>
      ) : null}
    </div>
  );
}

export function SyllabusWorkspace({ page = 'dashboard', portal = 'admin' }: Props) {
  const queryEnabled = useAuthQueryEnabled();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const user = session?.user;
  const [filters, setFilters] = useState<SyllabusFilters>({});

  const isStudent = portal === 'student';
  const canManage = Boolean(user?.permissions?.includes('syllabus-repository:manage'));
  const canContribute = Boolean(
    user?.permissions?.some((p: string) =>
      ['syllabus-repository:contribute', 'syllabus-repository:manage'].includes(p),
    ),
  );
  const canPublish = Boolean(
    user?.permissions?.some((p: string) =>
      ['syllabus-repository:publish', 'syllabus-repository:manage'].includes(p),
    ),
  );
  const canApprove = Boolean(
    user?.permissions?.some((p: string) =>
      [
        'syllabus-repository:approve',
        'syllabus-repository:publish',
        'syllabus-repository:manage',
      ].includes(p),
    ),
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['syllabus-repository'] });
  };

  const listParams = useMemo(() => patchParams(filters), [filters]);

  const dashboardQuery = useQuery({
    queryKey: ['syllabus-repository', 'dashboard'],
    queryFn: fetchSyllabusDashboard,
    enabled: queryEnabled && page === 'dashboard' && !isStudent,
  });

  const documentsQuery = useQuery({
    queryKey: ['syllabus-repository', 'documents', listParams, portal, page],
    queryFn: () => (isStudent ? fetchMySyllabusDocuments : fetchSyllabusDocuments)(listParams),
    enabled: queryEnabled && ['documents', 'student'].includes(page),
  });

  const bookmarksQuery = useQuery({
    queryKey: ['syllabus-repository', 'bookmarks'],
    queryFn: fetchMySyllabusBookmarks,
    enabled: queryEnabled && isStudent,
  });

  const approvalsQuery = useQuery({
    queryKey: ['syllabus-repository', 'approvals'],
    queryFn: () => fetchPendingSyllabusApprovals(),
    enabled: queryEnabled && page === 'workflow' && canApprove,
  });

  const publishableQuery = useQuery({
    queryKey: ['syllabus-repository', 'publishable'],
    queryFn: () => fetchSyllabusDocuments({ status: 'APPROVED', limit: 25 }),
    enabled: queryEnabled && page === 'workflow' && canManage,
  });

  if (page === 'dashboard' && !isStudent) {
    return <SyllabusDashboardPanel data={dashboardQuery.data} error={dashboardQuery.error} />;
  }

  if (page === 'upload') {
    return (
      <SyllabusUploadWizard canManage={canManage} canPublish={canPublish} onDone={invalidate} />
    );
  }

  if (page === 'workflow') {
    return (
      <WorkflowPanel
        approvals={approvalsQuery.data ?? []}
        documents={publishableQuery.data?.items ?? []}
        canManage={canManage}
        error={approvalsQuery.error ?? publishableQuery.error}
        onRefresh={invalidate}
      />
    );
  }

  if (page === 'settings') {
    return <SettingsPanel onSaved={invalidate} />;
  }

  if (isStudent) {
    const grouped = groupDocuments(documentsQuery.data?.items ?? []);
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search syllabus..."
              value={filters.q ?? ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
            />
          </div>
        </div>
        {Object.entries(grouped).map(([group, docs]) => (
          <section key={group}>
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <BookOpen className="h-4 w-4" /> {group}
            </h3>
            <DocumentsGrid
              documents={docs}
              filters={filters}
              onFiltersChange={setFilters}
              portal={portal}
              canContribute={false}
              canManage={false}
              canPublish={false}
              showFilters={false}
              title=""
              error={documentsQuery.error}
              onRefresh={invalidate}
            />
          </section>
        ))}
        {!Object.keys(grouped).length ? (
          <p className="text-sm text-muted-foreground">
            No syllabus documents are available for your enrollment yet.
          </p>
        ) : null}
        {bookmarksQuery.data?.length ? (
          <section>
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <Bookmark className="h-4 w-4" /> Bookmarks
            </h3>
            <DocumentsGrid
              documents={bookmarksQuery.data}
              filters={{}}
              onFiltersChange={() => undefined}
              portal={portal}
              canContribute={false}
              canManage={false}
              canPublish={false}
              showFilters={false}
              title=""
              onRefresh={invalidate}
            />
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 font-semibold">
        <FileText className="h-4 w-4" /> Syllabus Documents
      </h3>
      <DocumentsGrid
        documents={documentsQuery.data?.items ?? []}
        filters={filters}
        onFiltersChange={setFilters}
        portal={portal}
        canContribute={canContribute}
        canManage={canManage}
        canPublish={canPublish}
        error={documentsQuery.error}
        onRefresh={invalidate}
      />
    </div>
  );
}
