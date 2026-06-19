'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  Download,
  FileText,
  Search,
  Send,
  ShieldCheck,
  Upload,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useAuthQueryEnabled } from '@/hooks/use-auth';
import { apiErrorMessage } from '@/utils/api-error';
import {
  actOnQuestionPaperApproval,
  addQuestionBookmark,
  archiveQuestionPaper,
  commitQuestionBankBulk,
  createQuestionPaper,
  downloadQuestionBankTemplate,
  downloadQuestionPaper,
  fetchMyQuestionBookmarks,
  fetchMyQuestionPapers,
  fetchPendingQuestionApprovals,
  fetchQuestionBankDashboard,
  fetchQuestionBankReports,
  fetchQuestionBankSettings,
  fetchQuestionPaper,
  fetchQuestionPapers,
  previewQuestionBankBulk,
  publishQuestionPaper,
  removeQuestionBookmark,
  submitQuestionPaper,
  updateQuestionBankSettings,
} from '@/services/question-bank';
import type { QuestionPaper, QuestionPaperApproval } from '@/types/question-bank';

type Page =
  | 'dashboard'
  | 'papers'
  | 'upload'
  | 'faculty'
  | 'workflow'
  | 'student-access'
  | 'reports'
  | 'settings'
  | 'student';

type Props = {
  page?: Page;
  portal?: 'admin' | 'staff' | 'student';
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  PENDING_REVIEW: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  PUBLISHED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  ARCHIVED: 'bg-gray-100 text-gray-600',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-slate-100'}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function PaperDetailDrawer({
  paperId,
  portal,
  onClose,
}: {
  paperId: string;
  portal: Props['portal'];
  onClose: () => void;
}) {
  const queryEnabled = useAuthQueryEnabled();
  const detailQuery = useQuery({
    queryKey: ['question-bank', 'paper', paperId],
    queryFn: () => fetchQuestionPaper(paperId),
    enabled: queryEnabled && Boolean(paperId),
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const paper = detailQuery.data;
    if (paper?.mimeType !== 'application/pdf') {
      setPreviewUrl(null);
      return;
    }
    let active = true;
    let objectUrl: string | null = null;
    downloadQuestionPaper(paperId).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [detailQuery.data, paperId]);

  const paper = detailQuery.data;
  if (!paper) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl overflow-y-auto bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">{paper.paperName}</h3>
            <p className="text-sm text-muted-foreground">
              {paper.paperCode} · {paper.paperType} · {paper.examYear ?? '—'}
            </p>
            <div className="mt-2">
              <StatusBadge status={paper.status} />
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {previewUrl ? (
          <iframe
            src={previewUrl}
            title="Paper preview"
            className="mb-4 h-96 w-full rounded-lg border"
          />
        ) : null}

        {paper.approvals?.length ? (
          <div className="mb-4">
            <h4 className="mb-2 text-sm font-medium">Approval timeline</h4>
            <ul className="space-y-2 text-sm">
              {paper.approvals.map((step) => (
                <li key={step.id} className="rounded border px-3 py-2">
                  <span className="font-medium">{step.stepName}</span>
                  <span className="ml-2 text-muted-foreground">{step.status}</span>
                  {step.comments ? (
                    <p className="text-xs text-muted-foreground">{step.comments}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {paper.related?.length ? (
          <div>
            <h4 className="mb-2 text-sm font-medium">Related papers</h4>
            <ul className="space-y-1 text-sm">
              {paper.related.map((r) => (
                <li key={r.id}>
                  {r.paperCode} — {r.paperName} ({r.examYear ?? '—'})
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PaperTable({
  papers,
  portal,
  onRefresh,
  showActions = true,
}: {
  papers: QuestionPaper[];
  portal: Props['portal'];
  onRefresh: () => void;
  showActions?: boolean;
}) {
  const { session } = useAuth();
  const user = session?.user;
  const canManage = user?.permissions?.includes('question-bank:manage');
  const canPublish = user?.permissions?.includes('question-bank:publish') || canManage;
  const canContribute = user?.permissions?.includes('question-bank:contribute') || canManage;
  const isStudent = portal === 'student';
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const submitMut = useMutation({ mutationFn: submitQuestionPaper, onSuccess: onRefresh });
  const publishMut = useMutation({ mutationFn: publishQuestionPaper, onSuccess: onRefresh });
  const archiveMut = useMutation({ mutationFn: archiveQuestionPaper, onSuccess: onRefresh });
  const bookmarkMut = useMutation({ mutationFn: addQuestionBookmark, onSuccess: onRefresh });
  const unbookmarkMut = useMutation({ mutationFn: removeQuestionBookmark, onSuccess: onRefresh });

  const handleDownload = async (id: string, fileName?: string | null) => {
    const blob = await downloadQuestionPaper(id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName ?? 'question-paper';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!papers.length) {
    return <p className="text-sm text-muted-foreground">No papers found.</p>;
  }

  return (
    <>
      {selectedId ? (
        <PaperDetailDrawer
          paperId={selectedId}
          portal={portal}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Year</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {papers.map((paper) => (
              <tr key={paper.id} className="border-t">
                <td className="px-3 py-2 font-medium">{paper.paperCode}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-left hover:underline"
                    onClick={() => setSelectedId(paper.id)}
                  >
                    {paper.paperName}
                  </button>
                </td>
                <td className="px-3 py-2">{paper.paperType}</td>
                <td className="px-3 py-2">{paper.examYear ?? '—'}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={paper.status} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(paper.id, paper.fileName)}
                    >
                      <Download className="mr-1 h-3 w-3" /> Download
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
                          <BookmarkCheck className="h-4 w-4" />
                        ) : (
                          <Bookmark className="h-4 w-4" />
                        )}
                      </Button>
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
                    {showActions && (canManage || (canContribute && paper.status === 'DRAFT')) ? (
                      <Button size="sm" variant="ghost" onClick={() => archiveMut.mutate(paper.id)}>
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
    </>
  );
}

function SettingsPanel({
  settingsQuery,
  onSaved,
}: {
  settingsQuery: {
    data?: { maxUploadMb: number; studentAccessEnabled: boolean };
    isLoading: boolean;
  };
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ maxUploadMb: 25, studentAccessEnabled: true });
  const saveMut = useMutation({
    mutationFn: () => updateQuestionBankSettings(form),
    onSuccess: onSaved,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setForm({
        maxUploadMb: settingsQuery.data.maxUploadMb,
        studentAccessEnabled: settingsQuery.data.studentAccessEnabled,
      });
    }
  }, [settingsQuery.data]);

  return (
    <div className="max-w-md space-y-4 rounded-xl border p-4">
      <h3 className="font-semibold">Question Bank Settings</h3>
      <label className="block text-sm">Max upload (MB)</label>
      <Input
        type="number"
        value={form.maxUploadMb}
        onChange={(e) => setForm({ ...form, maxUploadMb: Number(e.target.value) })}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.studentAccessEnabled}
          onChange={(e) => setForm({ ...form, studentAccessEnabled: e.target.checked })}
        />
        Student access enabled
      </label>
      <Button
        disabled={saveMut.isPending || settingsQuery.isLoading}
        onClick={() => saveMut.mutate()}
      >
        Save Settings
      </Button>
    </div>
  );
}

export function QuestionBankWorkspace({ page = 'dashboard', portal = 'admin' }: Props) {
  const queryEnabled = useAuthQueryEnabled();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const user = session?.user;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [uploadForm, setUploadForm] = useState({
    paperCode: '',
    paperName: '',
    paperType: 'UNIVERSITY_EXAM',
    examYear: new Date().getFullYear().toString(),
    semesterNo: '',
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [bulkExcel, setBulkExcel] = useState<File | null>(null);
  const [bulkZip, setBulkZip] = useState<File | null>(null);
  const [bulkPreview, setBulkPreview] = useState<Awaited<
    ReturnType<typeof previewQuestionBankBulk>
  > | null>(null);

  const isStudent = portal === 'student';
  const canManage = user?.permissions?.includes('question-bank:manage');
  const canApprove = user?.permissions?.some((p: string) =>
    ['question-bank:approve', 'question-bank:publish', 'question-bank:manage'].includes(p),
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['question-bank'] });
  };

  const dashboardQuery = useQuery({
    queryKey: ['question-bank', 'dashboard'],
    queryFn: fetchQuestionBankDashboard,
    enabled: queryEnabled && page === 'dashboard' && !isStudent,
  });

  const papersQuery = useQuery({
    queryKey: ['question-bank', 'papers', search, statusFilter, portal],
    queryFn: () =>
      (isStudent ? fetchMyQuestionPapers : fetchQuestionPapers)({
        q: search || undefined,
        status: statusFilter || undefined,
        limit: 50,
      }),
    enabled: queryEnabled && ['papers', 'faculty', 'student-access', 'student'].includes(page),
  });

  const myUploadsQuery = useQuery({
    queryKey: ['question-bank', 'my-uploads'],
    queryFn: () => fetchQuestionPapers({ uploadedById: user?.id, limit: 50 }),
    enabled: queryEnabled && page === 'faculty' && portal === 'staff',
  });

  const approvalsQuery = useQuery({
    queryKey: ['question-bank', 'approvals'],
    queryFn: () => fetchPendingQuestionApprovals(),
    enabled: queryEnabled && page === 'workflow' && Boolean(canApprove),
  });

  const bookmarksQuery = useQuery({
    queryKey: ['question-bank', 'bookmarks'],
    queryFn: fetchMyQuestionBookmarks,
    enabled: queryEnabled && isStudent,
  });

  const reportsQuery = useQuery({
    queryKey: ['question-bank', 'reports'],
    queryFn: fetchQuestionBankReports,
    enabled: queryEnabled && page === 'reports',
  });

  const settingsQuery = useQuery({
    queryKey: ['question-bank', 'settings'],
    queryFn: fetchQuestionBankSettings,
    enabled: queryEnabled && page === 'settings' && Boolean(canManage),
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      Object.entries(uploadForm).forEach(([k, v]) => v && form.append(k, v));
      if (uploadFile) form.append('file', uploadFile);
      return createQuestionPaper(form);
    },
    onSuccess: () => {
      invalidate();
      setUploadForm({
        paperCode: '',
        paperName: '',
        paperType: 'UNIVERSITY_EXAM',
        examYear: new Date().getFullYear().toString(),
        semesterNo: '',
      });
      setUploadFile(null);
    },
  });

  const bulkPreviewMut = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      if (bulkExcel) form.append('excel', bulkExcel);
      if (bulkZip) form.append('zip', bulkZip);
      return previewQuestionBankBulk(form);
    },
    onSuccess: setBulkPreview,
  });

  const bulkCommitMut = useMutation({
    mutationFn: async () => {
      const rows =
        bulkPreview?.rows.filter((r) => r.status === 'VALID').map((r) => r.normalized!) ?? [];
      return commitQuestionBankBulk(rows, bulkZip ?? undefined);
    },
    onSuccess: () => {
      invalidate();
      setBulkPreview(null);
      setBulkExcel(null);
      setBulkZip(null);
    },
  });

  const approvalMut = useMutation({
    mutationFn: ({
      id,
      action,
      comments,
    }: {
      id: string;
      action: 'APPROVE' | 'REJECT';
      comments?: string;
    }) => actOnQuestionPaperApproval(id, { action, comments }),
    onSuccess: invalidate,
  });

  const facultyPapers = useMemo(() => {
    if (page === 'faculty' && portal === 'staff') return myUploadsQuery.data?.items ?? [];
    return papersQuery.data?.items ?? [];
  }, [page, portal, myUploadsQuery.data, papersQuery.data]);

  if (page === 'dashboard' && !isStudent) {
    const kpis = dashboardQuery.data?.kpis;
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Papers" value={kpis?.totalPapers ?? '—'} />
          <KpiCard label="Published" value={kpis?.publishedPapers ?? '—'} />
          <KpiCard label="Subjects Covered" value={kpis?.subjects ?? '—'} />
          <KpiCard label="Pending Approvals" value={kpis?.pendingApprovals ?? '—'} />
          <KpiCard label="Departments" value={kpis?.departments ?? '—'} />
          <KpiCard label="Academic Years" value={kpis?.academicYears ?? '—'} />
          <KpiCard label="Downloads This Month" value={kpis?.downloadsThisMonth ?? '—'} />
          <KpiCard
            label="Top Download"
            value={kpis?.topPaper?.paperCode ?? '—'}
            hint={kpis?.topPaper ? `${kpis.topPaper.downloads} downloads` : undefined}
          />
        </div>
        {dashboardQuery.isError ? (
          <p className="text-sm text-destructive">{apiErrorMessage(dashboardQuery.error)}</p>
        ) : null}
      </div>
    );
  }

  if (page === 'upload') {
    return (
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <Upload className="h-4 w-4" /> Single Upload
          </h3>
          <Input
            placeholder="Paper code (course code)"
            value={uploadForm.paperCode}
            onChange={(e) => setUploadForm({ ...uploadForm, paperCode: e.target.value })}
          />
          <Input
            placeholder="Paper title"
            value={uploadForm.paperName}
            onChange={(e) => setUploadForm({ ...uploadForm, paperName: e.target.value })}
          />
          <Input
            placeholder="Paper type"
            value={uploadForm.paperType}
            onChange={(e) => setUploadForm({ ...uploadForm, paperType: e.target.value })}
          />
          <Input
            placeholder="Exam year"
            value={uploadForm.examYear}
            onChange={(e) => setUploadForm({ ...uploadForm, examYear: e.target.value })}
          />
          <Input
            placeholder="Semester"
            value={uploadForm.semesterNo}
            onChange={(e) => setUploadForm({ ...uploadForm, semesterNo: e.target.value })}
          />
          <Input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
          <Button disabled={uploadMut.isPending} onClick={() => uploadMut.mutate()}>
            {uploadMut.isPending ? 'Uploading…' : 'Upload Paper'}
          </Button>
          {uploadMut.isError ? (
            <p className="text-sm text-destructive">{apiErrorMessage(uploadMut.error)}</p>
          ) : null}
        </div>

        {canManage ? (
          <div className="space-y-4 rounded-xl border p-4">
            <h3 className="font-semibold">Bulk Import (Excel + ZIP)</h3>
            <Button
              variant="outline"
              onClick={async () => {
                const blob = await downloadQuestionBankTemplate();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'question-bank-template.xlsx';
                a.click();
              }}
            >
              Download Template
            </Button>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setBulkExcel(e.target.files?.[0] ?? null)}
            />
            <Input
              type="file"
              accept=".zip"
              onChange={(e) => setBulkZip(e.target.files?.[0] ?? null)}
            />
            <div className="flex gap-2">
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
              <p className="text-sm text-muted-foreground">
                {bulkPreview.summary.valid} valid / {bulkPreview.summary.invalid} invalid /{' '}
                {bulkPreview.zipFileCount} ZIP files
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  if (page === 'workflow') {
    const approvals = approvalsQuery.data ?? [];
    return (
      <div className="space-y-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4" /> Approval Queue
        </h3>
        {!approvals.length ? (
          <p className="text-sm text-muted-foreground">No pending approvals.</p>
        ) : null}
        {approvals.map((approval: QuestionPaperApproval) => (
          <div
            key={approval.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
          >
            <div>
              <p className="font-medium">{approval.paper?.paperName ?? approval.paperId}</p>
              <p className="text-xs text-muted-foreground">
                {approval.stepName} · {approval.roleSlug}
              </p>
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
      </div>
    );
  }

  if (page === 'reports') {
    const r = reportsQuery.data;
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total Views" value={r?.views ?? '—'} />
        <KpiCard label="Total Downloads" value={r?.downloads ?? '—'} />
        <KpiCard label="Published Papers" value={r?.publishedPapers ?? '—'} />
      </div>
    );
  }

  if (page === 'settings' && canManage) {
    return <SettingsPanel settingsQuery={settingsQuery} onSaved={invalidate} />;
  }

  if (page === 'student-access') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Published papers visible to students based on enrollment.
        </p>
        <PaperTable
          papers={(papersQuery.data?.items ?? []).filter((p) => p.status === 'PUBLISHED')}
          portal={portal}
          onRefresh={invalidate}
          showActions={false}
        />
      </div>
    );
  }

  if (isStudent) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search papers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <section>
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <FileText className="h-4 w-4" /> Previous Year Papers
          </h3>
          <PaperTable
            papers={papersQuery.data?.items ?? []}
            portal={portal}
            onRefresh={invalidate}
          />
        </section>
        {bookmarksQuery.data?.length ? (
          <section>
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <Bookmark className="h-4 w-4" /> Bookmarks
            </h3>
            <PaperTable papers={bookmarksQuery.data} portal={portal} onRefresh={invalidate} />
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search papers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {page !== 'faculty' ? (
          <select
            className="rounded-md border px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="PUBLISHED">Published</option>
            <option value="REJECTED">Rejected</option>
          </select>
        ) : null}
      </div>
      {page === 'faculty' ? (
        <h3 className="flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4" /> Faculty Uploads
        </h3>
      ) : (
        <h3 className="flex items-center gap-2 font-semibold">
          <BarChart3 className="h-4 w-4" /> Paper Repository
        </h3>
      )}
      <PaperTable papers={facultyPapers} portal={portal} onRefresh={invalidate} />
      {papersQuery.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(papersQuery.error)}</p>
      ) : null}
    </div>
  );
}
