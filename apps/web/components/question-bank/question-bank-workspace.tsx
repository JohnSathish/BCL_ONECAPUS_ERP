'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, FileText, Search, ShieldCheck, Users } from 'lucide-react';

import { QuestionBankDashboardPanel } from './dashboard-panel';
import { KpiCard, StatusBadge } from './qb-shared';
import { RepositoryGrid } from './repository-grid';
import { QuestionPaperUploadWizard } from './upload-wizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  actOnQuestionPaperApproval,
  fetchMyQuestionBookmarks,
  fetchMyQuestionPapers,
  fetchPendingQuestionApprovals,
  fetchQuestionBankDashboard,
  fetchQuestionBankReports,
  fetchQuestionBankSettings,
  fetchQuestionPapers,
  updateQuestionBankSettings,
} from '@/services/question-bank';
import type { QuestionPaperApproval, QuestionPaperFilters } from '@/types/question-bank';
import { apiErrorMessage } from '@/utils/api-error';

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
  const [form, setForm] = useState({ maxUploadMb: 20, studentAccessEnabled: true });

  useEffect(() => {
    if (settingsQuery.data) {
      setForm({
        maxUploadMb: settingsQuery.data.maxUploadMb,
        studentAccessEnabled: settingsQuery.data.studentAccessEnabled,
      });
    }
  }, [settingsQuery.data]);

  const saveMut = useMutation({
    mutationFn: () => updateQuestionBankSettings(form),
    onSuccess: onSaved,
  });

  return (
    <div className="max-w-md space-y-4 rounded-xl border p-4">
      <h3 className="font-semibold">Repository settings</h3>
      <label className="block space-y-1 text-sm">
        <span>Max upload (MB)</span>
        <Input
          type="number"
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
      {saveMut.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(saveMut.error)}</p>
      ) : null}
    </div>
  );
}

export function QuestionBankWorkspace({ page = 'dashboard', portal = 'admin' }: Props) {
  const queryEnabled = useAuthQueryEnabled();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const user = session?.user;
  const [filters, setFilters] = useState<QuestionPaperFilters>({});
  const [search, setSearch] = useState('');

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

  const listParams = useMemo(() => {
    const params: Record<string, string | number | undefined> = {
      q: filters.q || undefined,
      status: filters.status || undefined,
      academicYearId: filters.academicYearId || undefined,
      semesterNo: filters.semesterNo ? Number(filters.semesterNo) : undefined,
      programVersionId: filters.programVersionId || undefined,
      departmentId: filters.departmentId || undefined,
      courseId: filters.courseId || undefined,
      paperType: filters.paperType || undefined,
      examYear: filters.examYear ? Number(filters.examYear) : undefined,
      language: filters.language || undefined,
      uploadedById: filters.uploadedById || undefined,
      limit: 50,
    };
    return params;
  }, [filters]);

  const papersQuery = useQuery({
    queryKey: ['question-bank', 'papers', listParams, portal, page],
    queryFn: () =>
      (isStudent ? fetchMyQuestionPapers : fetchQuestionPapers)(
        page === 'faculty' && portal === 'staff'
          ? { ...listParams, uploadedById: user?.id }
          : listParams,
      ),
    enabled: queryEnabled && ['papers', 'faculty', 'student-access', 'student'].includes(page),
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

  if (page === 'dashboard' && !isStudent) {
    return (
      <QuestionBankDashboardPanel
        data={dashboardQuery.data}
        isError={dashboardQuery.isError}
        error={dashboardQuery.error}
      />
    );
  }

  if (page === 'upload') {
    return <QuestionPaperUploadWizard canManage={Boolean(canManage)} onDone={invalidate} />;
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
              {approval.paper?.status ? <StatusBadge status={approval.paper.status} /> : null}
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
        <RepositoryGrid
          papers={(papersQuery.data?.items ?? []).filter((p) => p.status === 'PUBLISHED')}
          filters={filters}
          onFiltersChange={setFilters}
          portal={portal}
          onRefresh={invalidate}
          showActions={false}
          title="Student-visible papers"
          error={papersQuery.error}
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
              onChange={(e) => {
                setSearch(e.target.value);
                setFilters((f) => ({ ...f, q: e.target.value }));
              }}
            />
          </div>
        </div>
        <section>
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <FileText className="h-4 w-4" /> Previous Year Papers
          </h3>
          <RepositoryGrid
            papers={papersQuery.data?.items ?? []}
            filters={filters}
            onFiltersChange={setFilters}
            portal={portal}
            onRefresh={invalidate}
            showFilters={false}
            title=""
            error={papersQuery.error}
          />
        </section>
        {bookmarksQuery.data?.length ? (
          <section>
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <Bookmark className="h-4 w-4" /> Bookmarks
            </h3>
            <RepositoryGrid
              papers={bookmarksQuery.data}
              filters={{}}
              onFiltersChange={() => undefined}
              portal={portal}
              onRefresh={invalidate}
              showFilters={false}
              title=""
            />
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {page === 'faculty' ? (
        <h3 className="flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4" /> Faculty Uploads
        </h3>
      ) : null}
      <RepositoryGrid
        papers={papersQuery.data?.items ?? []}
        filters={filters}
        onFiltersChange={setFilters}
        portal={portal}
        onRefresh={invalidate}
        title={page === 'faculty' ? 'My uploads' : 'Question Paper Repository'}
        error={papersQuery.error}
      />
    </div>
  );
}
