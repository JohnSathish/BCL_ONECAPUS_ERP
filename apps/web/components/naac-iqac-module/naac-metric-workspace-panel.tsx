'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchStaffDirectory } from '@/services/staff';
import {
  addNaacWorkspaceComment,
  addNaacWorkspaceEvidence,
  assignNaacWorkspace,
  exportNaacTableXlsx,
  fetchNaacCriteriaTree,
  fetchNaacMetricTables,
  fetchNaacMetricWorkspace,
  fetchNaacMyWorkspaces,
  importNaacTableXlsx,
  patchNaacWorkspace,
  pullNaacTableErp,
  pullNaacWorkspaceErp,
  unassignNaacWorkspace,
  upsertNaacTableRows,
  verifyNaacEvidenceItem,
  workflowNaacWorkspace,
  type NaacMetricTableBundle,
} from '@/services/naac-iqac';
import type { NaacTreeMetric } from '@/types/naac-iqac';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const STATUS_TONE: Record<string, string> = {
  NOT_STARTED: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-sky-100 text-sky-800',
  EVIDENCE_PENDING: 'bg-amber-100 text-amber-800',
  SUBMITTED: 'bg-indigo-100 text-indigo-800',
  UNDER_REVIEW: 'bg-violet-100 text-violet-800',
  CHANGES_REQUESTED: 'bg-orange-100 text-orange-900',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  LOCKED: 'bg-zinc-200 text-zinc-800',
};

const TABS = [
  'Overview',
  'Metrics data',
  'Assigned Faculty',
  'Progress',
  'Evidence',
  'Reports',
  'Comments',
  'Approval',
  'History',
] as const;

type Tab = (typeof TABS)[number];

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge variant="outline">—</Badge>;
  return (
    <span
      className={cn(
        'inline-flex rounded px-2 py-0.5 text-xs font-medium',
        STATUS_TONE[status] ?? 'bg-muted text-foreground',
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function MetricRow({
  metric,
  selected,
  onSelect,
}: {
  metric: NaacTreeMetric;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
        selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold">{metric.code}</span>
          <Badge variant="outline" className="text-[10px]">
            {metric.metricType}
          </Badge>
          {metric.isMandatory ? (
            <Badge className="text-[10px]" variant="secondary">
              Mandatory
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-2 text-muted-foreground">{metric.title}</p>
      </div>
      <div className="shrink-0 text-right">
        <StatusBadge status={metric.workspace?.status} />
        <p className="mt-1 text-xs text-muted-foreground">
          {Math.round(metric.workspace?.progressPct ?? 0)}%
        </p>
      </div>
    </button>
  );
}

export function NaacMetricWorkspacePanel({
  mode = 'tree',
  portalMode = false,
  initialMetricCode,
}: {
  mode?: 'tree' | 'inbox';
  portalMode?: boolean;
  initialMetricCode?: string | null;
}) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [mandatoryOnly, setMandatoryOnly] = useState(false);
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedCode, setSelectedCode] = useState<string | null>(initialMetricCode ?? null);
  const [tab, setTab] = useState<Tab>('Overview');
  const [error, setError] = useState('');
  const [narrative, setNarrative] = useState('');
  const [deadline, setDeadline] = useState('');
  const [progressPct, setProgressPct] = useState('0');
  const [comment, setComment] = useState('');
  const [remark, setRemark] = useState('');
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [assignStaffId, setAssignStaffId] = useState('');
  const [assignRole, setAssignRole] = useState('FACULTY');
  const [staffQ, setStaffQ] = useState('');
  const [activeTableIdx, setActiveTableIdx] = useState(0);
  const [draftCells, setDraftCells] = useState<Record<string, Record<string, unknown>>>({});

  useEffect(() => {
    if (initialMetricCode) setSelectedCode(initialMetricCode);
  }, [initialMetricCode]);

  const treeQ = useQuery({
    queryKey: ['naac-criteria-tree', statusFilter, mandatoryOnly],
    queryFn: () =>
      fetchNaacCriteriaTree({
        status: statusFilter || undefined,
        mandatoryOnly: mandatoryOnly || undefined,
      }),
    enabled: enabled && mode === 'tree',
  });

  const inboxQ = useQuery({
    queryKey: ['naac-my-workspaces', portalMode],
    queryFn: () => fetchNaacMyWorkspaces(undefined, portalMode),
    enabled: enabled && mode === 'inbox',
  });

  const detailQ = useQuery({
    queryKey: ['naac-metric-workspace', selectedCode, portalMode],
    queryFn: () => fetchNaacMetricWorkspace(selectedCode!, undefined, portalMode),
    enabled: enabled && Boolean(selectedCode),
  });

  const tablesQ = useQuery({
    queryKey: ['naac-metric-tables', selectedCode],
    queryFn: () => fetchNaacMetricTables(selectedCode!),
    enabled: enabled && Boolean(selectedCode) && tab === 'Metrics data',
  });

  const staffDirQ = useQuery({
    queryKey: ['naac-staff-dir', staffQ],
    queryFn: () => fetchStaffDirectory({ q: staffQ || undefined, limit: 30 }),
    enabled: enabled && !portalMode && tab === 'Assigned Faculty',
  });

  useEffect(() => {
    setActiveTableIdx(0);
    setDraftCells({});
  }, [selectedCode]);

  useEffect(() => {
    const ws = detailQ.data?.workspace;
    if (!ws) return;
    setNarrative(ws.narrativeDraft ?? '');
    setDeadline(ws.deadline ? String(ws.deadline).slice(0, 10) : '');
    setProgressPct(String(Math.round(ws.progressPct ?? 0)));
  }, [detailQ.data?.workspace?.id]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['naac-criteria-tree'] });
    qc.invalidateQueries({ queryKey: ['naac-my-workspaces'] });
    qc.invalidateQueries({ queryKey: ['naac-metric-workspace'] });
    qc.invalidateQueries({ queryKey: ['naac-metric-tables'] });
    qc.invalidateQueries({ queryKey: ['naac-dashboard'] });
  };

  const patchMut = useMutation({
    mutationFn: () =>
      patchNaacWorkspace(detailQ.data!.workspace.id, {
        narrativeDraft: narrative,
        deadline: deadline || null,
        progressPct: Number(progressPct) || 0,
      }),
    onSuccess: () => {
      setError('');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Save failed')),
  });

  const pullErpMut = useMutation({
    mutationFn: () => pullNaacWorkspaceErp(detailQ.data!.workspace.id),
    onSuccess: () => {
      setError('');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'ERP pull failed')),
  });

  const activeTable: NaacMetricTableBundle | undefined =
    tablesQ.data?.tables?.[activeTableIdx] ?? tablesQ.data?.tables?.[0];

  const pullTableMut = useMutation({
    mutationFn: (datasetId: string) => pullNaacTableErp(datasetId),
    onSuccess: () => {
      setError('');
      setDraftCells({});
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Table ERP pull failed')),
  });

  const saveTableMut = useMutation({
    mutationFn: async () => {
      if (!activeTable) return;
      const rows = Object.entries(draftCells).map(([id, cells]) => ({
        id,
        cells,
        source: 'MANUAL',
      }));
      if (!rows.length) return;
      return upsertNaacTableRows(activeTable.dataset.id, rows);
    },
    onSuccess: () => {
      setError('');
      setDraftCells({});
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Save rows failed')),
  });

  const addRowMut = useMutation({
    mutationFn: () => {
      if (!activeTable) throw new Error('No table');
      const cols = activeTable.definition.columns ?? [];
      const empty: Record<string, unknown> = {};
      for (const c of cols) empty[c.key] = '';
      return upsertNaacTableRows(activeTable.dataset.id, [
        {
          rowIndex: activeTable.rows.length,
          cells: empty,
          source: 'MANUAL',
        },
      ]);
    },
    onSuccess: () => {
      setError('');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Add row failed')),
  });

  const importTableMut = useMutation({
    mutationFn: (file: File) => {
      if (!activeTable) throw new Error('No table');
      return importNaacTableXlsx(activeTable.dataset.id, file);
    },
    onSuccess: () => {
      setError('');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Import failed')),
  });

  const assignMut = useMutation({
    mutationFn: () =>
      assignNaacWorkspace(detailQ.data!.workspace.id, {
        staffProfileId: assignStaffId,
        role: assignRole,
      }),
    onSuccess: () => {
      setAssignStaffId('');
      setError('');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Assign failed')),
  });

  const unassignMut = useMutation({
    mutationFn: (assignmentId: string) =>
      unassignNaacWorkspace(detailQ.data!.workspace.id, assignmentId),
    onSuccess: invalidate,
    onError: (e) => setError(apiErrorMessage(e, 'Remove failed')),
  });

  const evidenceMut = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('title', evidenceTitle || 'Evidence');
      if (evidenceUrl) form.append('externalUrl', evidenceUrl);
      if (evidenceFile) form.append('file', evidenceFile);
      return addNaacWorkspaceEvidence(detailQ.data!.workspace.id, form);
    },
    onSuccess: () => {
      setEvidenceTitle('');
      setEvidenceUrl('');
      setEvidenceFile(null);
      setError('');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Evidence upload failed')),
  });

  const verifyMut = useMutation({
    mutationFn: ({ id, verificationStatus }: { id: string; verificationStatus: string }) =>
      verifyNaacEvidenceItem(id, { verificationStatus }),
    onSuccess: invalidate,
    onError: (e) => setError(apiErrorMessage(e, 'Verify failed')),
  });

  const commentMut = useMutation({
    mutationFn: () => addNaacWorkspaceComment(detailQ.data!.workspace.id, comment),
    onSuccess: () => {
      setComment('');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Comment failed')),
  });

  const workflowMut = useMutation({
    mutationFn: (action: 'submit' | 'verify' | 'approve' | 'reject' | 'reopen') =>
      workflowNaacWorkspace(detailQ.data!.workspace.id, action, remark || undefined),
    onSuccess: () => {
      setRemark('');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Workflow action failed')),
  });

  const filteredCriteria = useMemo(() => {
    const criteria = treeQ.data?.criteria ?? [];
    if (!q.trim()) return criteria;
    const needle = q.trim().toLowerCase();
    return criteria
      .map((c) => ({
        ...c,
        keyIndicators: c.keyIndicators
          .map((ki) => ({
            ...ki,
            metrics: ki.metrics.filter(
              (m) =>
                m.code.toLowerCase().includes(needle) || m.title.toLowerCase().includes(needle),
            ),
          }))
          .filter((ki) => ki.metrics.length > 0),
        metrics: c.metrics.filter(
          (m) => m.code.toLowerCase().includes(needle) || m.title.toLowerCase().includes(needle),
        ),
      }))
      .filter((c) => c.keyIndicators.length > 0 || c.metrics.length > 0);
  }, [treeQ.data, q]);

  const staffList = staffDirQ.data?.items ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
      <Card className="h-fit">
        <CardHeader className="space-y-3 pb-3">
          <CardTitle className="text-base">
            {mode === 'inbox' ? 'My Metrics' : 'Criteria tree'}
          </CardTitle>
          {mode === 'tree' ? (
            <div className="space-y-2">
              <Input
                placeholder="Search metric code or title"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All statuses</option>
                  {[
                    'NOT_STARTED',
                    'IN_PROGRESS',
                    'EVIDENCE_PENDING',
                    'SUBMITTED',
                    'UNDER_REVIEW',
                    'CHANGES_REQUESTED',
                    'APPROVED',
                    'LOCKED',
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={mandatoryOnly}
                    onChange={(e) => setMandatoryOnly(e.target.checked)}
                  />
                  Mandatory only
                </label>
              </div>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="max-h-[70vh] space-y-3 overflow-y-auto">
          {mode === 'inbox' ? (
            inboxQ.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (inboxQ.data?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No metrics assigned yet.</p>
            ) : (
              (inboxQ.data?.items ?? []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedCode(item.metric.code);
                    setTab('Overview');
                  }}
                  className={cn(
                    'flex w-full flex-col gap-1 rounded-md border px-3 py-2 text-left text-sm',
                    selectedCode === item.metric.code
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold">{item.metric.code}</span>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="line-clamp-2 text-muted-foreground">{item.metric.title}</p>
                  <p className="text-xs text-muted-foreground">
                    C{item.metric.criterion?.criterion} · {item.progressPct}%
                  </p>
                </button>
              ))
            )
          ) : treeQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            filteredCriteria.map((c) => {
              const open = expanded[c.id] ?? true;
              return (
                <div key={c.id} className="space-y-2">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 text-left"
                    onClick={() => setExpanded((prev) => ({ ...prev, [c.id]: !open }))}
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        Criterion {c.criterion}: {c.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.progressPct}% · {c.approvedCount}/{c.metricCount} approved
                      </p>
                    </div>
                  </button>
                  {open ? (
                    <div className="ml-4 space-y-3 border-l pl-3">
                      {c.keyIndicators.map((ki) => (
                        <div key={ki.id} className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">
                            {ki.code} · {ki.title}
                          </p>
                          {ki.metrics.map((m) => (
                            <MetricRow
                              key={m.id}
                              metric={m}
                              selected={selectedCode === m.code}
                              onSelect={() => {
                                setSelectedCode(m.code);
                                setTab('Overview');
                              }}
                            />
                          ))}
                        </div>
                      ))}
                      {c.metrics.map((m) => (
                        <MetricRow
                          key={m.id}
                          metric={m}
                          selected={selectedCode === m.code}
                          onSelect={() => {
                            setSelectedCode(m.code);
                            setTab('Overview');
                          }}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {selectedCode ? `Metric ${selectedCode}` : 'Select a metric to open workspace'}
          </CardTitle>
          {detailQ.data ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge status={detailQ.data.workspace.status} />
              <span>{detailQ.data.workspace.progressPct}%</span>
              <span>· {detailQ.data.academicYear}</span>
              <span>· {detailQ.data.metric.title}</span>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
          {!selectedCode ? (
            <p className="text-sm text-muted-foreground">
              Browse the tree and open a metric workspace.
            </p>
          ) : detailQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : !detailQ.data ? (
            <p className="text-sm text-muted-foreground">Workspace unavailable.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1 border-b pb-2">
                {TABS.map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={tab === t ? 'default' : 'ghost'}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>

              {tab === 'Overview' ? (
                <div className="space-y-3 text-sm">
                  <p>
                    <span className="font-medium">Key indicator:</span>{' '}
                    {detailQ.data.metric.keyIndicator
                      ? `${detailQ.data.metric.keyIndicator.code} — ${detailQ.data.metric.keyIndicator.title}`
                      : '—'}
                  </p>
                  <p>
                    <span className="font-medium">Type:</span>{' '}
                    {detailQ.data.metric.metricType ?? 'QLM'} / {detailQ.data.metric.dataType}
                    {detailQ.data.metric.isMandatory ? ' · Mandatory' : ''}
                  </p>
                  <p className="text-muted-foreground">{detailQ.data.metric.title}</p>
                </div>
              ) : null}

              {tab === 'Metrics data' || tab === 'Progress' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {tab === 'Metrics data' ? (
                    <div className="space-y-3 rounded border p-3 md:col-span-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">ERP auto-fill</p>
                          <p className="text-xs text-muted-foreground">
                            Source key:{' '}
                            {(detailQ.data.metric as { erpSourceKey?: string }).erpSourceKey ??
                              detailQ.data.workspace.erpSourceHints?.erpSourceKey ??
                              '—'}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pullErpMut.isPending}
                          onClick={() => pullErpMut.mutate()}
                        >
                          {pullErpMut.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Refresh from ERP
                        </Button>
                      </div>
                      {detailQ.data.workspace.erpSourceHints?.primary ? (
                        <div className="rounded bg-muted/40 p-3 text-sm">
                          <p className="font-medium">
                            Primary:{' '}
                            {String(
                              (detailQ.data.workspace.erpSourceHints.primary as { key?: string })
                                .key ?? 'value',
                            )}
                          </p>
                          <p className="text-2xl font-semibold">
                            {String(
                              (detailQ.data.workspace.erpSourceHints.primary as { value?: unknown })
                                .value ?? '—',
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {
                              (
                                detailQ.data.workspace.erpSourceHints.primary as {
                                  source?: string;
                                  pending?: boolean;
                                  message?: string;
                                }
                              ).source
                            }
                            {(
                              detailQ.data.workspace.erpSourceHints.primary as {
                                pending?: boolean;
                              }
                            ).pending
                              ? ' · pending'
                              : ''}
                          </p>
                          {(
                            detailQ.data.workspace.erpSourceHints.primary as {
                              message?: string;
                            }
                          ).message ? (
                            <p className="mt-1 text-xs text-amber-700">
                              {
                                (
                                  detailQ.data.workspace.erpSourceHints.primary as {
                                    message?: string;
                                  }
                                ).message
                              }
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No ERP hints yet. Click Refresh from ERP.
                        </p>
                      )}
                      {detailQ.data.workspace.erpSourceHints?.related ? (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {Object.entries(
                            detailQ.data.workspace.erpSourceHints.related as Record<
                              string,
                              { value?: unknown; source?: string; pending?: boolean }
                            >,
                          )
                            .filter(([k]) => k !== 'message')
                            .slice(0, 6)
                            .map(([k, v]) => (
                              <div key={k} className="rounded border px-2 py-1.5 text-xs">
                                <p className="text-muted-foreground">{k}</p>
                                <p className="font-semibold">
                                  {v && typeof v === 'object' && 'value' in v
                                    ? String(v.value ?? '—')
                                    : String(v ?? '—')}
                                  {v?.pending ? ' *' : ''}
                                </p>
                              </div>
                            ))}
                        </div>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        ERP values are hints only — saving progress below does not overwrite them.
                      </p>
                    </div>
                  ) : null}

                  {tab === 'Metrics data' ? (
                    <div className="space-y-3 rounded border p-3 md:col-span-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">Official NAAC table</p>
                          <p className="text-xs text-muted-foreground">
                            Columns match the Affiliated QnM Excel template.
                          </p>
                        </div>
                        {tablesQ.isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : null}
                      </div>

                      {(tablesQ.data?.tables?.length ?? 0) > 1 ? (
                        <div className="flex flex-wrap gap-1">
                          {tablesQ.data!.tables.map((t, i) => (
                            <Button
                              key={t.definition.id}
                              size="sm"
                              variant={i === activeTableIdx ? 'default' : 'outline'}
                              onClick={() => {
                                setActiveTableIdx(i);
                                setDraftCells({});
                              }}
                            >
                              {t.definition.sheetName}
                            </Button>
                          ))}
                        </div>
                      ) : null}

                      {!tablesQ.isLoading && !tablesQ.data?.tables?.length ? (
                        <p className="text-sm text-muted-foreground">
                          No official Excel sheet is linked to this metric yet.
                        </p>
                      ) : null}

                      {activeTable ? (
                        <>
                          <p className="text-sm font-medium leading-snug">
                            {activeTable.definition.title}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={pullTableMut.isPending || portalMode}
                              onClick={() => pullTableMut.mutate(activeTable.dataset.id)}
                            >
                              {pullTableMut.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : null}
                              Pull from ERP
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={portalMode}
                              onClick={() =>
                                exportNaacTableXlsx(
                                  activeTable.dataset.id,
                                  `naac-${activeTable.definition.code}.xlsx`,
                                ).catch((e) => setError(apiErrorMessage(e, 'Export failed')))
                              }
                            >
                              Export sheet
                            </Button>
                            <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50">
                              {importTableMut.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : null}
                              Import sheet
                              <input
                                type="file"
                                accept=".xlsx,.xls"
                                className="hidden"
                                disabled={importTableMut.isPending || portalMode}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) importTableMut.mutate(f);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={addRowMut.isPending || portalMode}
                              onClick={() => addRowMut.mutate()}
                            >
                              Add manual row
                            </Button>
                            <Button
                              size="sm"
                              disabled={
                                saveTableMut.isPending ||
                                !Object.keys(draftCells).length ||
                                portalMode
                              }
                              onClick={() => saveTableMut.mutate()}
                            >
                              {saveTableMut.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : null}
                              Save edits
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {activeTable.rows.length} row(s)
                            {activeTable.dataset.lastPulledAt
                              ? ` · last ERP pull ${String(activeTable.dataset.lastPulledAt).slice(0, 19)}`
                              : ''}
                            {' · '}ERP re-pull keeps MANUAL / IMPORT rows.
                          </p>
                          <div className="max-h-[420px] overflow-auto rounded border">
                            <table className="min-w-full border-collapse text-xs">
                              <thead className="sticky top-0 z-10 bg-muted">
                                <tr>
                                  <th className="border-b px-2 py-1.5 text-left font-medium">
                                    Src
                                  </th>
                                  {(activeTable.definition.columns ?? []).map((c) => (
                                    <th
                                      key={c.key}
                                      className="border-b px-2 py-1.5 text-left font-medium whitespace-nowrap"
                                      title={c.label}
                                    >
                                      {c.label.length > 40 ? `${c.label.slice(0, 40)}…` : c.label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {activeTable.rows.length === 0 ? (
                                  <tr>
                                    <td
                                      className="px-2 py-3 text-muted-foreground"
                                      colSpan={(activeTable.definition.columns?.length ?? 0) + 1}
                                    >
                                      Empty grid — Pull from ERP or add a manual row.
                                    </td>
                                  </tr>
                                ) : (
                                  activeTable.rows.map((row) => {
                                    const cells =
                                      draftCells[row.id] ??
                                      (row.cells as Record<string, unknown>) ??
                                      {};
                                    return (
                                      <tr
                                        key={row.id}
                                        className="odd:bg-background even:bg-muted/20"
                                      >
                                        <td className="border-b px-2 py-1 align-top">
                                          <Badge variant="outline" className="text-[10px]">
                                            {row.source}
                                          </Badge>
                                        </td>
                                        {(activeTable.definition.columns ?? []).map((c) => (
                                          <td
                                            key={c.key}
                                            className="border-b px-1 py-0.5 align-top"
                                          >
                                            <Input
                                              className="h-7 min-w-[7rem] text-xs"
                                              value={String(cells[c.key] ?? '')}
                                              disabled={row.locked || portalMode}
                                              onChange={(e) => {
                                                setDraftCells((prev) => ({
                                                  ...prev,
                                                  [row.id]: {
                                                    ...cells,
                                                    [c.key]: e.target.value,
                                                  },
                                                }));
                                              }}
                                            />
                                          </td>
                                        ))}
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="space-y-2 md:col-span-2">
                    <Label>Narrative draft</Label>
                    <textarea
                      className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={narrative}
                      onChange={(e) => setNarrative(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Progress %</Label>
                    <Input value={progressPct} onChange={(e) => setProgressPct(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Deadline</Label>
                    <Input
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button onClick={() => patchMut.mutate()} disabled={patchMut.isPending}>
                      Save progress
                    </Button>
                  </div>
                </div>
              ) : null}

              {tab === 'Assigned Faculty' ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {(detailQ.data.workspace.assignments ?? []).map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-2 rounded border px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">{a.staff?.fullName ?? a.staffProfileId}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.role}
                            {a.staff?.employeeCode ? ` · ${a.staff.employeeCode}` : ''}
                          </p>
                        </div>
                        {!portalMode ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => unassignMut.mutate(a.id)}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    ))}
                    {!detailQ.data.workspace.assignments.length ? (
                      <p className="text-sm text-muted-foreground">No assignees.</p>
                    ) : null}
                  </div>
                  {!portalMode ? (
                    <div className="grid gap-2 rounded border p-3 md:grid-cols-3">
                      <div className="space-y-1 md:col-span-3">
                        <Label>Find staff</Label>
                        <Input
                          value={staffQ}
                          onChange={(e) => setStaffQ(e.target.value)}
                          placeholder="Search directory"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label>Staff</Label>
                        <select
                          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                          value={assignStaffId}
                          onChange={(e) => setAssignStaffId(e.target.value)}
                        >
                          <option value="">Select…</option>
                          {staffList.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.fullName}
                              {s.employeeCode ? ` (${s.employeeCode})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label>Role</Label>
                        <select
                          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                          value={assignRole}
                          onChange={(e) => setAssignRole(e.target.value)}
                        >
                          {[
                            'FACULTY',
                            'METRIC_COORD',
                            'CRITERION_COORD',
                            'IQAC_COORD',
                            'PRINCIPAL',
                            'VERIFIER',
                            'NAAC_COORD',
                          ].map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <Button
                          disabled={!assignStaffId || assignMut.isPending}
                          onClick={() => assignMut.mutate()}
                        >
                          Assign
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tab === 'Evidence' ? (
                <div className="space-y-4">
                  {(detailQ.data.workspace.evidence ?? []).map((ev) => (
                    <div key={ev.id} className="rounded border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{ev.title}</p>
                        <StatusBadge status={ev.verificationStatus} />
                      </div>
                      <p className="text-xs text-muted-foreground">{ev.evidenceType}</p>
                      <ul className="mt-2 space-y-1 text-xs">
                        {ev.versions.map((v) => (
                          <li key={v.id}>
                            v{v.versionNo}: {v.fileName || v.externalUrl || '—'}
                            {v.changeNote ? ` — ${v.changeNote}` : ''}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            verifyMut.mutate({
                              id: ev.id,
                              verificationStatus: 'VERIFIED',
                            })
                          }
                        >
                          Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            verifyMut.mutate({
                              id: ev.id,
                              verificationStatus: 'REJECTED',
                            })
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="grid gap-2 rounded border p-3">
                    <Label>Title</Label>
                    <Input
                      value={evidenceTitle}
                      onChange={(e) => setEvidenceTitle(e.target.value)}
                    />
                    <Label>External link (optional)</Label>
                    <Input value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} />
                    <Label>File (optional)</Label>
                    <Input
                      type="file"
                      onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
                    />
                    <Button
                      disabled={evidenceMut.isPending || (!evidenceFile && !evidenceUrl)}
                      onClick={() => evidenceMut.mutate()}
                    >
                      Add evidence
                    </Button>
                  </div>
                </div>
              ) : null}

              {tab === 'Reports' ? (
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    Use these exports for the affiliated-college SSR / AQAR pack. Approved and
                    locked metrics feed AQAR sync and the QNM workbook.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href="/admin/naac/reports">SSR / Reports hub</a>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <a href="/admin/naac/aqar">Open AQAR</a>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <a href="/admin/naac/dvv">DVV clarifications</a>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <a href="/admin/naac/evidence">Evidence repository</a>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Status: {detailQ.data.workspace.status} · Progress{' '}
                    {detailQ.data.workspace.progressPct}%
                  </p>
                </div>
              ) : null}

              {tab === 'Comments' ? (
                <div className="space-y-3">
                  {(detailQ.data.workspace.comments ?? []).map((c) => (
                    <div key={c.id} className="rounded border px-3 py-2 text-sm">
                      <p>{c.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  <textarea
                    className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Internal note"
                  />
                  <Button
                    disabled={!comment.trim() || commentMut.isPending}
                    onClick={() => commentMut.mutate()}
                  >
                    Post comment
                  </Button>
                </div>
              ) : null}

              {tab === 'Approval' ? (
                <div className="space-y-4">
                  {detailQ.data.approval?.exists ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        Chain status: {detailQ.data.approval.instance?.status ?? '—'}
                        {detailQ.data.approval.pendingRole
                          ? ` · pending ${detailQ.data.approval.pendingRole}`
                          : ''}
                      </p>
                      <ol className="space-y-1">
                        {(detailQ.data.approval.steps ?? []).map(
                          (s: {
                            stepOrder: number;
                            name: string;
                            assigneeRole?: string | null;
                            done?: boolean;
                            current?: boolean;
                          }) => (
                            <li
                              key={s.stepOrder}
                              className={cn(
                                'rounded border px-3 py-2 text-sm',
                                s.current && 'border-primary bg-primary/5',
                                s.done && 'opacity-70',
                              )}
                            >
                              <span className="font-medium">
                                {s.stepOrder}. {s.name}
                              </span>
                              {s.assigneeRole ? (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  ({s.assigneeRole})
                                </span>
                              ) : null}
                              {s.current ? (
                                <Badge className="ml-2 text-[10px]">Current</Badge>
                              ) : null}
                              {s.done ? (
                                <Badge variant="secondary" className="ml-2 text-[10px]">
                                  Done
                                </Badge>
                              ) : null}
                            </li>
                          ),
                        )}
                      </ol>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Submit to start Faculty → Metric Coord → Criterion Coord → IQAC → Principal
                      approval.
                    </p>
                  )}

                  {(detailQ.data.approvalTimeline?.length ?? 0) > 0 ? (
                    <div className="max-h-48 space-y-1 overflow-auto rounded border p-2">
                      <p className="text-xs font-medium text-muted-foreground">Activity timeline</p>
                      {detailQ.data.approvalTimeline!.map(
                        (e: { id: string; event: string; note?: string | null; at: string }) => (
                          <div key={e.id} className="text-xs">
                            <span className="font-medium">{e.event}</span>
                            {e.note ? ` — ${e.note}` : ''}
                            <span className="ml-2 text-muted-foreground">
                              {new Date(e.at).toLocaleString()}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Domain approval log</p>
                    {(detailQ.data.workspace.approvals ?? []).map((a) => (
                      <div key={a.id} className="rounded border px-3 py-2 text-sm">
                        <p className="font-medium">{a.step}</p>
                        {a.remark ? <p className="text-muted-foreground">{a.remark}</p> : null}
                        <p className="text-xs text-muted-foreground">
                          {new Date(a.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                  <Input
                    placeholder="Remark (required for request changes)"
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['submit', 'Submit'],
                        ['approve', 'Approve step'],
                        ['reject', 'Request changes'],
                        ['reopen', 'Reopen'],
                      ] as const
                    ).map(([action, label]) => (
                      <Button
                        key={action}
                        variant={action === 'reject' ? 'outline' : 'default'}
                        disabled={workflowMut.isPending}
                        onClick={() => workflowMut.mutate(action)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}

              {tab === 'History' ? (
                <div className="space-y-2">
                  {(detailQ.data.history ?? []).map((h) => (
                    <div key={h.id} className="rounded border px-3 py-2 text-sm">
                      <p className="font-medium">{h.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(h.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {!detailQ.data.history?.length ? (
                    <p className="text-sm text-muted-foreground">No audit events yet.</p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
