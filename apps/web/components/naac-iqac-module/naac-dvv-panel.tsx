'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  actNaacDvvApproval,
  addNaacDvvComment,
  addNaacDvvEvidenceLink,
  addNaacDvvResponse,
  createNaacDvvClarification,
  fetchNaacDvvClarification,
  fetchNaacDvvClarifications,
  fetchNaacDvvReadiness,
  submitNaacDvvForReview,
} from '@/services/naac-iqac';
import { apiErrorMessage } from '@/utils/api-error';

export function NaacDvvPanel() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [academicYear, setAcademicYear] = useState('2025-26');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    metricCode: '3.3.1',
    queryCode: '',
    title: '',
    naacQueryText: '',
  });
  const [responseBody, setResponseBody] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [remark, setRemark] = useState('');
  const [evidenceLink, setEvidenceLink] = useState({
    evidenceItemId: '',
    vaultDocumentId: '',
    note: '',
  });

  const readinessQ = useQuery({
    queryKey: ['naac-dvv', academicYear],
    queryFn: () => fetchNaacDvvReadiness(academicYear),
    enabled,
  });

  const listQ = useQuery({
    queryKey: ['naac-dvv-clarifications', academicYear],
    queryFn: () => fetchNaacDvvClarifications({ academicYear }),
    enabled,
  });

  const detailQ = useQuery({
    queryKey: ['naac-dvv-clarification', selectedId],
    queryFn: () => fetchNaacDvvClarification(selectedId!),
    enabled: enabled && Boolean(selectedId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['naac-dvv-clarifications'] });
    qc.invalidateQueries({ queryKey: ['naac-dvv-clarification'] });
    qc.invalidateQueries({ queryKey: ['naac-dvv'] });
  };

  const createMut = useMutation({
    mutationFn: () =>
      createNaacDvvClarification({
        metricCode: form.metricCode,
        queryCode: form.queryCode || `DVV-${Date.now()}`,
        title: form.title,
        naacQueryText: form.naacQueryText,
        academicYear,
      }),
    onSuccess: (row: { id: string }) => {
      setError('');
      setSelectedId(row.id);
      setForm({ metricCode: '3.3.1', queryCode: '', title: '', naacQueryText: '' });
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Create failed')),
  });

  const responseMut = useMutation({
    mutationFn: () => addNaacDvvResponse(selectedId!, responseBody),
    onSuccess: () => {
      setResponseBody('');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Save response failed')),
  });

  const commentMut = useMutation({
    mutationFn: () => addNaacDvvComment(selectedId!, commentBody),
    onSuccess: () => {
      setCommentBody('');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Comment failed')),
  });

  const submitMut = useMutation({
    mutationFn: () => submitNaacDvvForReview(selectedId!, remark || undefined),
    onSuccess: () => {
      setRemark('');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Submit failed')),
  });

  const actMut = useMutation({
    mutationFn: (action: string) => actNaacDvvApproval(selectedId!, action, remark || undefined),
    onSuccess: () => {
      setRemark('');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Approval action failed')),
  });

  const evidenceLinkMut = useMutation({
    mutationFn: () =>
      addNaacDvvEvidenceLink(selectedId!, {
        evidenceItemId: evidenceLink.evidenceItemId || undefined,
        vaultDocumentId: evidenceLink.vaultDocumentId || undefined,
        note: evidenceLink.note || undefined,
      }),
    onSuccess: () => {
      setEvidenceLink({ evidenceItemId: '', vaultDocumentId: '', note: '' });
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Evidence link failed')),
  });

  const rows = (listQ.data ?? []) as Array<{
    id: string;
    queryCode: string;
    title: string;
    status: string;
    metric?: { code?: string };
  }>;

  const detail = detailQ.data as
    | {
        title: string;
        queryCode: string;
        status: string;
        naacQueryText: string;
        metric?: { code?: string; title?: string };
        responses?: Array<{ versionNo: number; body: string }>;
        comments?: Array<{ id: string; body: string; createdAt: string }>;
        approval?: {
          exists?: boolean;
          pendingRole?: string | null;
          instance?: { status?: string };
          steps?: Array<{
            stepOrder: number;
            name: string;
            current?: boolean;
            done?: boolean;
          }>;
        };
        timeline?: Array<{ id: string; event: string; note?: string; at: string }>;
      }
    | undefined;

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="max-w-xs space-y-1">
        <Label>Academic year</Label>
        <Input
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          placeholder="2025-26"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>DVV Readiness — {readinessQ.data?.readinessScore ?? 0}%</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded border p-3">
            <p className="text-sm text-muted-foreground">Metrics Missing</p>
            <p className="text-2xl font-bold text-rose-600">
              {readinessQ.data?.documentsMissing ?? 0}
            </p>
          </div>
          <div className="rounded border p-3">
            <p className="text-sm text-muted-foreground">Faculty Pending</p>
            <p className="text-2xl font-bold">{readinessQ.data?.facultyPending ?? 0}</p>
          </div>
          <div className="rounded border p-3">
            <p className="text-sm text-muted-foreground">Clarifications</p>
            <p className="text-2xl font-bold">{rows.length}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Clarification queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-64 space-y-2 overflow-auto">
              {listQ.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {rows.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm hover:bg-muted/50"
                  onClick={() => setSelectedId(r.id)}
                >
                  <span>
                    <span className="font-mono text-xs">{r.queryCode}</span>
                    <span className="ml-2">{r.title}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{r.metric?.code}</span>
                  </span>
                  <Badge variant="outline">{r.status}</Badge>
                </button>
              ))}
              {!rows.length && !listQ.isLoading ? (
                <p className="text-sm text-muted-foreground">No clarifications yet.</p>
              ) : null}
            </div>

            <div className="space-y-2 border-t pt-3">
              <p className="text-sm font-medium">New clarification</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label>Metric code</Label>
                  <Input
                    value={form.metricCode}
                    onChange={(e) => setForm((f) => ({ ...f, metricCode: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Query code</Label>
                  <Input
                    value={form.queryCode}
                    placeholder="auto if blank"
                    onChange={(e) => setForm((f) => ({ ...f, queryCode: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <Label>NAAC query text</Label>
                <textarea
                  className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.naacQueryText}
                  onChange={(e) => setForm((f) => ({ ...f, naacQueryText: e.target.value }))}
                />
              </div>
              <Button
                disabled={!form.title || !form.naacQueryText || createMut.isPending}
                onClick={() => createMut.mutate()}
              >
                Create
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clarification detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedId ? (
              <p className="text-sm text-muted-foreground">Select a case.</p>
            ) : detailQ.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : detail ? (
              <>
                <div>
                  <p className="font-medium">
                    {detail.queryCode} — {detail.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {detail.metric?.code} · {detail.status}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{detail.naacQueryText}</p>
                </div>

                {detail.approval?.exists ? (
                  <div className="rounded border p-2 text-xs">
                    <p>
                      Approval: {detail.approval.instance?.status}
                      {detail.approval.pendingRole
                        ? ` · pending ${detail.approval.pendingRole}`
                        : ''}
                    </p>
                    <ol className="mt-1 space-y-0.5">
                      {(detail.approval.steps ?? []).map((s) => (
                        <li key={s.stepOrder}>
                          {s.stepOrder}. {s.name}
                          {s.current ? ' (current)' : ''}
                          {s.done ? ' ✓' : ''}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                <div>
                  <Label>Response draft</Label>
                  <textarea
                    className="mt-1 min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={responseBody}
                    onChange={(e) => setResponseBody(e.target.value)}
                  />
                  <Button
                    size="sm"
                    className="mt-2"
                    disabled={!responseBody || responseMut.isPending}
                    onClick={() => responseMut.mutate()}
                  >
                    Save response version
                  </Button>
                  {(detail.responses ?? []).slice(0, 2).map((r) => (
                    <p key={r.versionNo} className="mt-2 text-xs text-muted-foreground">
                      v{r.versionNo}: {r.body.slice(0, 120)}
                      {r.body.length > 120 ? '…' : ''}
                    </p>
                  ))}
                </div>

                <div>
                  <Label>Link evidence</Label>
                  <div className="mt-1 grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="Workspace evidence item ID"
                      value={evidenceLink.evidenceItemId}
                      onChange={(e) =>
                        setEvidenceLink((f) => ({
                          ...f,
                          evidenceItemId: e.target.value,
                        }))
                      }
                    />
                    <Input
                      placeholder="Vault document ID"
                      value={evidenceLink.vaultDocumentId}
                      onChange={(e) =>
                        setEvidenceLink((f) => ({
                          ...f,
                          vaultDocumentId: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <Input
                    className="mt-2"
                    placeholder="Note (optional)"
                    value={evidenceLink.note}
                    onChange={(e) => setEvidenceLink((f) => ({ ...f, note: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={
                      evidenceLinkMut.isPending ||
                      (!evidenceLink.evidenceItemId && !evidenceLink.vaultDocumentId)
                    }
                    onClick={() => evidenceLinkMut.mutate()}
                  >
                    Attach evidence link
                  </Button>
                </div>

                <div>
                  <Label>Internal comment</Label>
                  <Input
                    className="mt-1"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={!commentBody || commentMut.isPending}
                    onClick={() => commentMut.mutate()}
                  >
                    Post comment
                  </Button>
                </div>

                <Input
                  placeholder="Remark for submit / approval"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={submitMut.isPending}
                    onClick={() => submitMut.mutate()}
                  >
                    Submit for review
                  </Button>
                  {['APPROVE', 'REQUEST_CHANGES', 'REOPEN'].map((a) => (
                    <Button
                      key={a}
                      size="sm"
                      variant="outline"
                      disabled={actMut.isPending}
                      onClick={() => actMut.mutate(a)}
                    >
                      {a.replace('_', ' ')}
                    </Button>
                  ))}
                </div>

                {(detail.timeline?.length ?? 0) > 0 ? (
                  <div className="max-h-32 overflow-auto rounded border p-2 text-xs">
                    {detail.timeline!.map((t) => (
                      <div key={t.id}>
                        <span className="font-medium">{t.event}</span>
                        {t.note ? ` — ${t.note}` : ''}
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Not found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
