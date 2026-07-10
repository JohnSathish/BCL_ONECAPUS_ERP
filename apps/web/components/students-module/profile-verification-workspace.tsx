'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Download, Loader2, Printer, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  bulkReviewProfileRequests,
  exportProfileVerificationReport,
  fetchClassXiiVerificationQueue,
  fetchPendingStudentDocuments,
  fetchProfileCompletionDashboard,
  fetchProfileSoftGates,
  fetchProfileUpdatePolicy,
  fetchProfileVerificationHistory,
  fetchProfileVerificationPending,
  reviewProfileRequest,
  updateProfileSoftGates,
  updateProfileUpdatePolicy,
  type ProfileChangeRequest,
  type ProfileSoftGate,
} from '@/services/student-profile-verification';
import { verifyStudentDocument } from '@/services/students';
import { apiErrorMessage } from '@/utils/api-error';
import { downloadBlob } from '@/utils/download-blob';

type Mode = 'pending' | 'class-xii' | 'documents' | 'completion' | 'history' | 'policy';

export function ProfileVerificationWorkspace({ mode }: { mode: Mode }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});

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
    }: {
      studentId: string;
      docId: string;
      status: 'VERIFIED' | 'REJECTED';
    }) => verifyStudentDocument(studentId, docId, { verificationStatus: status }),
    onSuccess: async () => {
      setMessage('Document updated');
      await qc.invalidateQueries({ queryKey: ['profile-verification', 'documents'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Document verify failed')),
  });

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

  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);

  return (
    <div className="space-y-4 print:space-y-2">
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

      {(mode === 'pending' || mode === 'class-xii') && (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button
            size="sm"
            variant="outline"
            disabled={!requestRows.length}
            onClick={() => {
              const next: Record<string, boolean> = {};
              for (const row of requestRows) next[row.id] = true;
              setSelected(next);
            }}
          >
            Select all
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!selectedCount}
            onClick={() => setSelected({})}
          >
            Clear
          </Button>
          <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
          <Button
            size="sm"
            disabled={!selectedCount || bulkMut.isPending}
            onClick={() => bulkMut.mutate('APPROVE')}
          >
            Bulk approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedCount || bulkMut.isPending}
            onClick={() => bulkMut.mutate('REJECT')}
          >
            Bulk reject
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!selectedCount || bulkMut.isPending}
            onClick={() => bulkMut.mutate('NEEDS_INFO')}
          >
            Bulk needs info
          </Button>
        </div>
      )}

      {(mode === 'pending' || mode === 'class-xii' || mode === 'history') && (
        <RequestTable
          rows={requestRows}
          loading={pendingQ.isLoading || classXiiQ.isLoading || historyQ.isLoading}
          showActions={mode !== 'history'}
          selectable={mode !== 'history'}
          selected={selected}
          onToggle={(id, on) => setSelected((prev) => ({ ...prev, [id]: on }))}
          onReview={(id, action) => reviewMut.mutate({ id, action })}
          reviewing={reviewMut.isPending || bulkMut.isPending}
        />
      )}

      {mode === 'documents' && (
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
              {((docsQ.data as any[]) ?? []).map((doc) => (
                <tr key={doc.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <p className="font-medium">{doc.student?.masterProfile?.fullName ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.student?.rollNumber ?? '—'}
                    </p>
                  </td>
                  <td className="px-3 py-2">{doc.documentType}</td>
                  <td className="px-3 py-2 text-xs">
                    {doc.createdAt ? new Date(doc.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
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
                        onClick={() =>
                          verifyDocMut.mutate({
                            studentId: doc.studentId ?? doc.student?.id,
                            docId: doc.id,
                            status: 'REJECTED',
                          })
                        }
                      >
                        <X className="mr-1 h-3 w-3" />
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
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

      {mode === 'completion' && (
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

      {mode === 'policy' && (
        <div className="space-y-4">
          <SoftGatesPanel
            gates={softGatesQ.data}
            loading={softGatesQ.isLoading}
            saving={softGatesMut.isPending}
            onSave={(payload) => softGatesMut.mutate(payload)}
          />
          <div className="overflow-auto rounded-2xl border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Section</th>
                  <th className="px-3 py-2">Field</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Mandatory</th>
                </tr>
              </thead>
              <tbody>
                {(policyQ.data ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2">{row.sectionKey}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.fieldKey}</td>
                    <td className="px-3 py-2">
                      <select
                        className="h-8 rounded border bg-background px-2 text-xs"
                        value={row.approvalMode}
                        onChange={(e) =>
                          policyMut.mutate([
                            {
                              sectionKey: row.sectionKey,
                              fieldKey: row.fieldKey,
                              approvalMode: e.target.value,
                            },
                          ])
                        }
                      >
                        <option value="AUTO_APPROVE">Auto Approve</option>
                        <option value="APPROVAL_REQUIRED">Approval Required</option>
                        <option value="VERIFICATION_REQUIRED">Verification Required</option>
                        <option value="READ_ONLY">Read Only</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">{row.mandatory ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {policyMut.isPending ? (
              <p className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function SoftGatesPanel({
  gates,
  loading,
  saving,
  onSave,
}: {
  gates?: ProfileSoftGate;
  loading: boolean;
  saving: boolean;
  onSave: (payload: Partial<ProfileSoftGate>) => void;
}) {
  const [draft, setDraft] = useState<Partial<ProfileSoftGate> | null>(null);
  const value = draft ??
    gates ?? {
      enabled: false,
      minCompletionPercent: 80,
      remindOnLogin: true,
      softBlockRegistration: false,
      softBlockCertificates: false,
    };

  return (
    <>
      {loading && !gates ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading soft gates…
        </p>
      ) : null}
      {!(loading && !gates) ? (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div>
            <h2 className="text-sm font-semibold">Soft service gates</h2>
            <p className="text-xs text-muted-foreground">
              Remind students on incomplete profiles. Optional soft blocks apply only to student
              self-service registration and certificate requests.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(value.enabled)}
                onChange={(e) => setDraft({ ...value, enabled: e.target.checked })}
              />
              Enable soft gates
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.remindOnLogin !== false}
                onChange={(e) => setDraft({ ...value, remindOnLogin: e.target.checked })}
              />
              Remind on login / profile home
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(value.softBlockRegistration)}
                onChange={(e) => setDraft({ ...value, softBlockRegistration: e.target.checked })}
              />
              Soft-block semester registration submit
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(value.softBlockCertificates)}
                onChange={(e) => setDraft({ ...value, softBlockCertificates: e.target.checked })}
              />
              Soft-block certificate requests
            </label>
            <label className="text-sm sm:col-span-2">
              Minimum completion %
              <input
                type="number"
                min={0}
                max={100}
                className="mt-1 h-9 w-28 rounded border bg-background px-2"
                value={Number(value.minCompletionPercent ?? 80)}
                onChange={(e) =>
                  setDraft({
                    ...value,
                    minCompletionPercent: Number(e.target.value || 0),
                  })
                }
              />
            </label>
          </div>
          <Button
            size="sm"
            disabled={saving}
            onClick={() =>
              onSave({
                enabled: Boolean(value.enabled),
                minCompletionPercent: Number(value.minCompletionPercent ?? 80),
                remindOnLogin: value.remindOnLogin !== false,
                softBlockRegistration: Boolean(value.softBlockRegistration),
                softBlockCertificates: Boolean(value.softBlockCertificates),
              })
            }
          >
            {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            Save soft gates
          </Button>
        </div>
      ) : null}
    </>
  );
}

function RequestTable({
  rows,
  loading,
  showActions,
  selectable,
  selected,
  onToggle,
  onReview,
  reviewing,
}: {
  rows: ProfileChangeRequest[];
  loading: boolean;
  showActions: boolean;
  selectable: boolean;
  selected: Record<string, boolean>;
  onToggle: (id: string, on: boolean) => void;
  onReview: (id: string, action: 'APPROVE' | 'REJECT' | 'NEEDS_INFO') => void;
  reviewing: boolean;
}) {
  const colSpan = (selectable ? 1 : 0) + 4 + (showActions ? 1 : 0);
  return (
    <div className="overflow-auto rounded-2xl border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          <tr>
            {selectable ? <th className="px-3 py-2"> </th> : null}
            <th className="px-3 py-2">Student</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Fields</th>
            <th className="px-3 py-2">Submitted</th>
            {showActions ? <th className="px-3 py-2">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border align-top">
              {selectable ? (
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[row.id])}
                    onChange={(e) => onToggle(row.id, e.target.checked)}
                  />
                </td>
              ) : null}
              <td className="px-3 py-2">
                <p className="font-medium">{row.student?.masterProfile?.fullName ?? '—'}</p>
                <p className="text-xs text-muted-foreground">
                  {row.student?.rollNumber ?? row.student?.enrollmentNumber ?? '—'}
                </p>
              </td>
              <td className="px-3 py-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{row.status}</span>
              </td>
              <td className="px-3 py-2 text-xs">
                {(row.items ?? [])
                  .map((i) => `${i.sectionKey}.${i.fieldKey} (${i.approvalStatus})`)
                  .join(', ') || '—'}
              </td>
              <td className="px-3 py-2 text-xs">
                {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '—'}
              </td>
              {showActions ? (
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      disabled={reviewing}
                      onClick={() => onReview(row.id, 'APPROVE')}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reviewing}
                      onClick={() => onReview(row.id, 'REJECT')}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={reviewing}
                      onClick={() => onReview(row.id, 'NEEDS_INFO')}
                    >
                      Needs info
                    </Button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
          {!loading && rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="px-3 py-8 text-center text-muted-foreground">
                No records.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
