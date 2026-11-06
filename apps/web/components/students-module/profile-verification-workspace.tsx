'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Info,
  Loader2,
  Printer,
  Search,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { ProfileUpdatePolicyBoard } from '@/components/students-module/profile-update-policy-board';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import {
  bulkReviewProfileRequests,
  exportProfileVerificationReport,
  fetchClassXiiVerificationQueue,
  fetchPendingStudentDocuments,
  fetchProfileCompletionDashboard,
  fetchProfileSoftGates,
  fetchProfileUpdatePolicy,
  fetchProfileUpdateWindow,
  fetchProfileVerificationHistory,
  fetchProfileVerificationPending,
  reopenAllProfileUpdate,
  reopenStudentProfileUpdate,
  revokeStudentProfileUpdate,
  reviewProfileRequest,
  updateProfileSoftGates,
  updateProfileUpdatePolicy,
  updateProfileUpdateWindow,
  type ProfileChangeRequest,
  type ProfileSoftGate,
  type ProfileUpdateWindowSettings,
} from '@/services/student-profile-verification';
import { fetchAcademicYears } from '@/services/organization';
import { verifyStudentDocument } from '@/services/students';
import { apiErrorMessage } from '@/utils/api-error';
import { downloadBlob } from '@/utils/download-blob';

function openUploadedDocument(filePath?: string | null) {
  const url = resolveUploadAssetUrl(filePath);
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

type Mode = 'pending' | 'class-xii' | 'documents' | 'completion' | 'history' | 'policy';

export function ProfileVerificationWorkspace({ mode }: { mode: Mode }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');

  const pendingQ = useQuery({
    queryKey: ['profile-verification', 'pending'],
    queryFn: () => fetchProfileVerificationPending({ status: 'PENDING' }),
    enabled: mode === 'pending',
  });
  const classXiiQ = useQuery({
    queryKey: ['profile-verification', 'class-xii'],
    queryFn: fetchClassXiiVerificationQueue,
    enabled: mode === 'class-xii',
  });
  const docsQ = useQuery({
    queryKey: ['profile-verification', 'documents'],
    queryFn: fetchPendingStudentDocuments,
    enabled: mode === 'documents',
  });
  const completionQ = useQuery({
    queryKey: ['profile-verification', 'completion'],
    queryFn: fetchProfileCompletionDashboard,
    enabled: mode === 'completion',
  });
  const historyQ = useQuery({
    queryKey: ['profile-verification', 'history'],
    queryFn: () => fetchProfileVerificationHistory({ take: 200 }),
    enabled: mode === 'history',
  });
  const policyQ = useQuery({
    queryKey: ['profile-verification', 'policy'],
    queryFn: fetchProfileUpdatePolicy,
    enabled: mode === 'policy',
  });
  const softGatesQ = useQuery({
    queryKey: ['profile-verification', 'soft-gates'],
    queryFn: fetchProfileSoftGates,
    enabled: mode === 'policy',
  });

  const updateWindowQ = useQuery({
    queryKey: ['profile-verification', 'update-window'],
    queryFn: fetchProfileUpdateWindow,
    enabled: mode === 'policy' || mode === 'pending',
  });
  const yearsQ = useQuery({
    queryKey: ['organization', 'academic-years', 'profile-verification'],
    queryFn: fetchAcademicYears,
    enabled: mode === 'pending' || mode === 'class-xii',
  });

  const reviewMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' | 'NEEDS_INFO' }) =>
      reviewProfileRequest(id, action),
    onSuccess: async () => {
      setMessage('Updated');
      await qc.invalidateQueries({ queryKey: ['profile-verification'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Review failed')),
  });

  const bulkMut = useMutation({
    mutationFn: (action: 'APPROVE' | 'REJECT' | 'NEEDS_INFO') =>
      bulkReviewProfileRequests(
        Object.entries(selected)
          .filter(([, on]) => on)
          .map(([id]) => id),
        action,
      ),
    onSuccess: async (res) => {
      setMessage(`Bulk ${res.action}: ${res.succeeded} ok, ${res.failed} failed`);
      setSelected({});
      await qc.invalidateQueries({ queryKey: ['profile-verification'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Bulk review failed')),
  });

  const verifyDocMut = useMutation({
    mutationFn: ({
      studentId,
      docId,
      status,
      remarks,
    }: {
      studentId: string;
      docId: string;
      status: 'VERIFIED' | 'REJECTED';
      remarks?: string;
    }) =>
      verifyStudentDocument(studentId, docId, {
        verificationStatus: status,
        verificationRemarks: remarks,
      }),
    onSuccess: async () => {
      setMessage('Document updated');
      await qc.invalidateQueries({ queryKey: ['profile-verification', 'documents'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Document verify failed')),
  });

  const rejectPendingDocument = (doc: {
    id: string;
    studentId?: string;
    student?: { id?: string };
  }) => {
    const remarks = window.prompt(
      'Optional rejection reason (shown to the student / office notes):',
      '',
    );
    if (remarks === null) return;
    verifyDocMut.mutate({
      studentId: doc.studentId ?? doc.student?.id ?? '',
      docId: doc.id,
      status: 'REJECTED',
      remarks: remarks.trim() || 'Rejected — please re-upload a clear matching document',
    });
  };

  const policyMut = useMutation({
    mutationFn: (rows: Array<{ sectionKey: string; fieldKey: string; approvalMode: string }>) =>
      updateProfileUpdatePolicy(rows),
    onSuccess: async () => {
      setMessage('Policy saved');
      await qc.invalidateQueries({ queryKey: ['profile-verification', 'policy'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Policy save failed')),
  });

  const softGatesMut = useMutation({
    mutationFn: (payload: Partial<ProfileSoftGate>) => updateProfileSoftGates(payload),
    onSuccess: async () => {
      setMessage('Soft gates saved');
      await qc.invalidateQueries({ queryKey: ['profile-verification', 'soft-gates'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Soft gate save failed')),
  });

  const updateWindowMut = useMutation({
    mutationFn: (payload: Partial<ProfileUpdateWindowSettings>) =>
      updateProfileUpdateWindow(payload),
    onSuccess: async () => {
      setMessage('Profile update window saved');
      await qc.invalidateQueries({ queryKey: ['profile-verification', 'update-window'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Update window save failed')),
  });

  const reopenAllMut = useMutation({
    mutationFn: (payload: { startsAt?: string | null; endsAt: string }) =>
      reopenAllProfileUpdate(payload),
    onSuccess: async () => {
      setMessage('Profile update window reopened for all students');
      await qc.invalidateQueries({ queryKey: ['profile-verification', 'update-window'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Reopen all failed')),
  });

  const title =
    mode === 'pending'
      ? 'Pending Profile Updates'
      : mode === 'class-xii'
        ? 'Class XII Verification'
        : mode === 'documents'
          ? 'Document Verification'
          : mode === 'completion'
            ? 'Profile Completion Dashboard'
            : mode === 'history'
              ? 'Profile Update History'
              : 'Profile Update Policy';

  const requestRows =
    (mode === 'pending' ? pendingQ.data : mode === 'class-xii' ? classXiiQ.data : historyQ.data) ??
    [];
  const queueMode = mode === 'pending' || mode === 'class-xii';
  const activeYearName =
    yearsQ.data?.find((year) => String(year.status ?? '').toUpperCase() === 'ACTIVE')?.name ??
    yearsQ.data?.[0]?.name;
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return requestRows;
    return requestRows.filter((row) => {
      const name = row.student?.masterProfile?.fullName ?? '';
      const roll = row.student?.rollNumber ?? row.student?.enrollmentNumber ?? '';
      const fields = (row.items ?? [])
        .map((item) => `${item.fieldLabel ?? ''} ${item.displayValue ?? ''} ${item.newValue ?? ''}`)
        .join(' ');
      return `${name} ${roll} ${fields}`.toLowerCase().includes(query);
    });
  }, [requestRows, search]);
  const queueCounts = useMemo(() => countQueue(requestRows), [requestRows]);

  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);

  const activeQuery =
    mode === 'pending'
      ? pendingQ
      : mode === 'class-xii'
        ? classXiiQ
        : mode === 'documents'
          ? docsQ
          : mode === 'completion'
            ? completionQ
            : mode === 'history'
              ? historyQ
              : policyQ;

  const modeErrorTitle =
    mode === 'pending'
      ? 'Unable to load pending profile updates'
      : mode === 'class-xii'
        ? 'Unable to load Class XII verification queue'
        : mode === 'documents'
          ? 'Unable to load document verification queue'
          : mode === 'completion'
            ? 'Unable to load profile completion dashboard'
            : mode === 'history'
              ? 'Unable to load profile update history'
              : 'Unable to load profile update policy';

  if (mode === 'policy') {
    return (
      <div className="space-y-4">
        {activeQuery.isError ? (
          <QueryErrorPanel
            title={modeErrorTitle}
            error={activeQuery.error}
            onRetry={() => void activeQuery.refetch()}
            isRetrying={activeQuery.isFetching}
          />
        ) : (
          <ProfileUpdatePolicyBoard
            windowSettings={updateWindowQ.data}
            windowLoading={updateWindowQ.isLoading}
            windowSaving={updateWindowMut.isPending || reopenAllMut.isPending}
            onSaveWindow={(payload) => updateWindowMut.mutate(payload)}
            onReopenAll={(payload) => reopenAllMut.mutate(payload)}
            gates={softGatesQ.data}
            gatesLoading={softGatesQ.isLoading}
            gatesSaving={softGatesMut.isPending}
            onSaveGates={(payload) => softGatesMut.mutate(payload)}
            policies={policyQ.data ?? []}
            policiesLoading={policyQ.isLoading}
            policySaving={policyMut.isPending}
            onChangeApproval={(row, approvalMode) =>
              policyMut.mutate([
                { sectionKey: row.sectionKey, fieldKey: row.fieldKey, approvalMode },
              ])
            }
            message={message}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 print:space-y-2">
      {queueMode ? (
        <QueueHero
          title={mode === 'class-xii' ? 'Class XII Verification' : 'Student Profile Verification'}
          yearName={activeYearName}
          counts={queueCounts}
        />
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground print:hidden">
              Review student self-service updates. Academic, fee, and exam fields stay locked.
            </p>
          </div>
          {mode === 'completion' ? (
            <Button
              size="sm"
              variant="outline"
              className="print:hidden"
              onClick={() => window.print()}
            >
              <Printer className="mr-1 h-3 w-3" />
              Print
            </Button>
          ) : null}
        </div>
      )}
      {mode === 'completion' ? (
        <div className="flex flex-wrap gap-2 print:hidden">
          {(
            [
              ['incomplete', 'Incomplete'],
              ['missing-aadhaar', 'Missing Aadhaar'],
              ['missing-bank', 'Missing Bank'],
              ['missing-class-xii', 'Missing Class XII'],
              ['pending-verification', 'Pending Verification'],
              ['department-completion', 'By Department'],
            ] as const
          ).map(([type, label]) => (
            <Button
              key={type}
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const blob = await exportProfileVerificationReport(type, 'xlsx');
                  downloadBlob(blob, `${type}.xlsx`);
                } catch (e) {
                  setMessage(apiErrorMessage(e, 'Export failed'));
                }
              }}
            >
              <Download className="mr-1 h-3 w-3" />
              {label}
            </Button>
          ))}
        </div>
      ) : null}
      {message ? <p className="text-sm text-muted-foreground print:hidden">{message}</p> : null}

      {activeQuery.isError ? (
        <QueryErrorPanel
          title={modeErrorTitle}
          error={activeQuery.error}
          onRetry={() => void activeQuery.refetch()}
          isRetrying={activeQuery.isFetching}
        />
      ) : null}

      {(mode === 'pending' || mode === 'class-xii') && !activeQuery.isError && (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button
            size="sm"
            variant="outline"
            className="border-slate-300 bg-white"
            disabled={!filteredRows.length}
            onClick={() => {
              const next: Record<string, boolean> = {};
              for (const row of filteredRows) next[row.id] = true;
              setSelected(next);
            }}
          >
            Select All
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!selectedCount}
            onClick={() => setSelected({})}
          >
            Clear
          </Button>
          <span className="text-xs font-medium text-slate-500">{selectedCount} selected</span>
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={!selectedCount || bulkMut.isPending}
            onClick={() => bulkMut.mutate('APPROVE')}
          >
            Bulk Approve
          </Button>
          <Button
            size="sm"
            className="bg-rose-600 text-white hover:bg-rose-700"
            disabled={!selectedCount || bulkMut.isPending}
            onClick={() => bulkMut.mutate('REJECT')}
          >
            Bulk Reject
          </Button>
          <Button
            size="sm"
            className="bg-sky-600 text-white hover:bg-sky-700"
            disabled={!selectedCount || bulkMut.isPending}
            onClick={() => bulkMut.mutate('NEEDS_INFO')}
          >
            Bulk Needs Info
          </Button>
          <div className="relative ml-auto min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by Name, Roll Number or Registration No."
              className="h-9 bg-white pl-8"
            />
          </div>
        </div>
      )}

      {(mode === 'pending' || mode === 'class-xii' || mode === 'history') &&
        !activeQuery.isError && (
          <RequestTable
            rows={queueMode ? filteredRows : requestRows}
            loading={pendingQ.isLoading || classXiiQ.isLoading || historyQ.isLoading}
            showActions={mode !== 'history'}
            pendingOnly={mode !== 'history'}
            selectable={mode !== 'history'}
            colorful={queueMode}
            selected={selected}
            onToggle={(id, on) => setSelected((prev) => ({ ...prev, [id]: on }))}
            onReview={(id, action) => reviewMut.mutate({ id, action })}
            reviewing={reviewMut.isPending || bulkMut.isPending}
          />
        )}

      {mode === 'documents' && !activeQuery.isError && (
        <div className="overflow-auto rounded-2xl border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">Document</th>
                <th className="px-3 py-2">Uploaded</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {((docsQ.data as any[]) ?? []).map((doc) => {
                const viewUrl = resolveUploadAssetUrl(doc.filePath);
                return (
                  <tr key={doc.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <p className="font-medium">{doc.student?.masterProfile?.fullName ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.student?.rollNumber ?? '—'}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium">{doc.documentType}</p>
                      {doc.fileName ? (
                        <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {doc.createdAt ? new Date(doc.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {viewUrl ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openUploadedDocument(doc.filePath)}
                          >
                            <ExternalLink className="mr-1 h-3 w-3" />
                            View
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          disabled={verifyDocMut.isPending}
                          onClick={() =>
                            verifyDocMut.mutate({
                              studentId: doc.studentId ?? doc.student?.id,
                              docId: doc.id,
                              status: 'VERIFIED',
                            })
                          }
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={verifyDocMut.isPending}
                          onClick={() => rejectPendingDocument(doc)}
                        >
                          <X className="mr-1 h-3 w-3" />
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!docsQ.isLoading && !(docsQ.data as any[])?.length ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    No pending documents.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {mode === 'completion' && !activeQuery.isError && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Average completion" value={`${completionQ.data?.overallAverage ?? 0}%`} />
            <Stat label="Incomplete profiles" value={completionQ.data?.incompleteCount ?? 0} />
            <Stat label="Departments" value={completionQ.data?.departmentSummary?.length ?? 0} />
          </div>
          <div className="overflow-auto rounded-2xl border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">%</th>
                  <th className="px-3 py-2">Missing</th>
                </tr>
              </thead>
              <tbody>
                {(completionQ.data?.students ?? []).slice(0, 200).map((row: any) => (
                  <tr key={row.studentId} className="border-t border-border">
                    <td className="px-3 py-2">
                      <p className="font-medium">{row.fullName}</p>
                      <p className="text-xs text-muted-foreground">{row.rollNumber ?? '—'}</p>
                    </td>
                    <td className="px-3 py-2">{row.department}</td>
                    <td className="px-3 py-2 font-semibold">{row.percent}%</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {(row.missing ?? []).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function formatYearBadge(name: string) {
  const trimmed = name.trim();
  if (/^ay\b/i.test(trimmed)) return trimmed.replace(/^ay/i, 'AY');
  return `AY ${trimmed.replace(/^academic year\s*/i, '')}`;
}

function countQueue(rows: ProfileChangeRequest[]) {
  const counts = { total: rows.length, pending: 0, approved: 0, rejected: 0, needsInfo: 0 };
  for (const row of rows) {
    const status = String(row.status ?? '').toUpperCase();
    if (status === 'APPROVED') counts.approved += 1;
    else if (status === 'REJECTED') counts.rejected += 1;
    else if (status === 'NEEDS_INFO') counts.needsInfo += 1;
    else counts.pending += 1;
  }
  return counts;
}

function QueueHero({
  title,
  yearName,
  counts,
}: {
  title: string;
  yearName?: string;
  counts: ReturnType<typeof countQueue>;
}) {
  const cards = [
    {
      label: 'Total Requests',
      value: counts.total,
      icon: Users,
      wrap: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Pending',
      value: counts.pending,
      icon: Clock,
      wrap: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Approved',
      value: counts.approved,
      icon: CheckCircle2,
      wrap: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Rejected',
      value: counts.rejected,
      icon: XCircle,
      wrap: 'bg-rose-50 text-rose-600',
    },
    {
      label: 'Needs Info',
      value: counts.needsInfo,
      icon: Info,
      wrap: 'bg-sky-50 text-sky-600',
    },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Users className="h-4 w-4" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {yearName ? (
          <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
            {formatYearBadge(yearName)}
          </span>
        ) : null}
        <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
          Odd Cycle
        </span>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
          ACTIVE
        </span>
      </div>
      <div className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <p>
          <span className="font-semibold">Pending Profile Updates. </span>
          Approve blood group and any other student update still waiting for a decision. Aadhaar is
          saved on the profile directly. Academic, fee, and exam fields stay locked.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <div
            key={card.label}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-full ${card.wrap}`}
            >
              <card.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-medium text-slate-500">{card.label}</p>
              <p className="text-2xl font-semibold tabular-nums text-slate-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestTable({
  rows,
  loading,
  showActions,
  pendingOnly,
  selectable,
  colorful = false,
  selected,
  onToggle,
  onReview,
  reviewing,
}: {
  rows: ProfileChangeRequest[];
  loading: boolean;
  showActions: boolean;
  pendingOnly?: boolean;
  selectable: boolean;
  colorful?: boolean;
  selected: Record<string, boolean>;
  onToggle: (id: string, on: boolean) => void;
  onReview: (id: string, action: 'APPROVE' | 'REJECT' | 'NEEDS_INFO') => void;
  reviewing: boolean;
}) {
  const colSpan = (selectable ? 1 : 0) + 4 + (showActions ? 1 : 0);
  return (
    <div
      className={
        colorful
          ? 'overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm'
          : 'overflow-auto rounded-2xl border border-border'
      }
    >
      <table className="min-w-full text-sm">
        <thead
          className={
            colorful
              ? 'bg-blue-700 text-left text-[11px] font-semibold uppercase tracking-wide text-white'
              : 'bg-muted/40 text-left text-xs uppercase text-muted-foreground'
          }
        >
          <tr>
            {selectable ? <th className="px-3 py-3"> </th> : null}
            <th className="px-3 py-3">Student</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Fields (Update Details)</th>
            <th className="px-3 py-3">Submitted</th>
            {showActions ? <th className="px-3 py-3">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-200 align-top">
              {selectable ? (
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[row.id])}
                    onChange={(e) => onToggle(row.id, e.target.checked)}
                  />
                </td>
              ) : null}
              <td className="px-3 py-3">
                <p className="font-semibold uppercase text-slate-900">
                  {row.student?.masterProfile?.fullName ?? '—'}
                </p>
                <p className="text-xs font-medium text-slate-500">
                  {row.student?.rollNumber ?? row.student?.enrollmentNumber ?? '—'}
                </p>
              </td>
              <td className="px-3 py-3">
                <StatusPill status={row.status} />
              </td>
              <td className="px-3 py-3 text-xs">
                <div className="max-w-xl space-y-2">
                  {(row.items ?? [])
                    .filter(
                      (item) =>
                        !pendingOnly ||
                        item.approvalStatus === 'PENDING' ||
                        item.approvalStatus === 'NEEDS_INFO',
                    )
                    .map((item) => (
                      <div key={item.id} className="rounded-lg bg-slate-50 px-2.5 py-2">
                        <p className="font-semibold text-blue-800">
                          {item.fieldLabel ?? `${item.sectionKey}.${item.fieldKey}`}
                        </p>
                        <FieldValue value={item.displayValue ?? item.newValue} />
                      </div>
                    ))}
                </div>
              </td>
              <td className="px-3 py-3 text-xs text-slate-600">
                {row.submittedAt ? formatSubmitted(row.submittedAt) : '—'}
              </td>
              {showActions ? (
                <td className="px-3 py-3">
                  <div className="flex min-w-[7.5rem] flex-col gap-1.5">
                    <Button
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={reviewing}
                      onClick={() => onReview(row.id, 'APPROVE')}
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      className="bg-rose-600 text-white hover:bg-rose-700"
                      disabled={reviewing}
                      onClick={() => onReview(row.id, 'REJECT')}
                    >
                      <X className="mr-1 h-3 w-3" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-sky-500 text-sky-700 hover:bg-sky-50"
                      disabled={reviewing}
                      onClick={() => onReview(row.id, 'NEEDS_INFO')}
                    >
                      Needs Info
                    </Button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
          {!loading && rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="px-3 py-8 text-center text-muted-foreground">
                {pendingOnly ? 'No profile updates are waiting for approval.' : 'No records.'}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const key = String(status ?? '').toUpperCase();
  const tone =
    key === 'APPROVED'
      ? 'bg-emerald-100 text-emerald-800'
      : key === 'REJECTED'
        ? 'bg-rose-100 text-rose-800'
        : key === 'NEEDS_INFO'
          ? 'bg-sky-100 text-sky-800'
          : 'bg-amber-100 text-amber-800';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>
      {key.replaceAll('_', ' ') || 'PENDING'}
    </span>
  );
}

function formatSubmitted(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function FieldValue({ value }: { value?: string | null }) {
  const parsed = parseJsonRecord(value);
  const subjects = Array.isArray(parsed?.subjects) ? parsed.subjects : null;
  if (!parsed || !subjects) {
    return <p className="mt-1 break-words text-slate-700">{value || '—'}</p>;
  }
  const meta = [parsed.boardName, parsed.stream, parsed.examYear, parsed.schoolName]
    .filter((part) => part != null && String(part).trim())
    .join(' · ');
  return (
    <div className="mt-1 space-y-1.5">
      {meta ? <p className="text-slate-600">{meta}</p> : null}
      <ul className="grid gap-1 sm:grid-cols-2">
        {subjects.map((subject, index) => {
          const name = String(subject.subjectName ?? subject.name ?? `Subject ${index + 1}`);
          const got = subject.marksObtained ?? '—';
          const max = subject.maxMarks ?? '—';
          return (
            <li
              key={`${name}-${index}`}
              className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1 text-slate-800"
            >
              <span className="font-medium">{name}</span>
              <span className="tabular-nums text-slate-500">
                {String(got)}/{String(max)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function parseJsonRecord(value?: string | null) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as {
      boardName?: string;
      stream?: string;
      examYear?: string | number;
      schoolName?: string;
      subjects?: Array<{
        subjectName?: string;
        name?: string;
        marksObtained?: string | number | null;
        maxMarks?: string | number | null;
      }>;
    };
  } catch {
    return null;
  }
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
