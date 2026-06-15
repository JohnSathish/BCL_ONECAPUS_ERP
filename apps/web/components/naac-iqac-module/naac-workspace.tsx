'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Award, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createNaacAqar,
  createNaacDepartmentSubmission,
  createNaacFacultyAchievement,
  createNaacMou,
  createNaacStudentAchievement,
  exportNaacReport,
  fetchNaacAqar,
  fetchNaacAqars,
  fetchNaacCalendar,
  fetchNaacCriteria,
  fetchNaacDashboard,
  fetchNaacDepartmentDashboard,
  fetchNaacDvvReadiness,
  fetchNaacEvidence,
  fetchNaacFacultyAchievements,
  fetchNaacIqacSummary,
  fetchNaacMous,
  fetchNaacSettings,
  fetchNaacStudentAchievements,
  fetchNaacVault,
  syncNaacAqarSection,
  updateNaacSettings,
  uploadNaacVault,
} from '@/services/naac-iqac';
import type { NaacPage } from '@/types/naac-iqac';
import { EvidenceTagUploadForm } from '@/components/naac-iqac-module/evidence-tag-upload-form';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

function scoreTone(score: number) {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-rose-600';
}

function CriterionBar({
  criterion,
  title,
  score,
}: {
  criterion: number;
  title: string;
  score: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>
          Criterion {criterion}: {title}
        </span>
        <span className={cn('font-semibold', scoreTone(score))}>{score}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className={cn('h-2 rounded-full bg-primary transition-all')}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function DataTable({ rows, columns }: { rows: Record<string, unknown>[]; columns: string[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No records found.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 text-left font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t">
              {columns.map((c) => (
                <td key={c} className="px-3 py-2">
                  {String(row[c] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NaacWorkspace({ page }: { page: NaacPage }) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [selectedAqarId, setSelectedAqarId] = useState<string | null>(null);
  const [evidenceCriterion, setEvidenceCriterion] = useState('');
  const [evidenceYear, setEvidenceYear] = useState('2025-26');
  const [vaultUploadKey, setVaultUploadKey] = useState(0);
  const [error, setError] = useState('');

  const dashboardQ = useQuery({
    queryKey: ['naac-dashboard'],
    queryFn: fetchNaacDashboard,
    enabled,
  });
  const evidenceQ = useQuery({
    queryKey: ['naac-evidence', evidenceCriterion, evidenceYear],
    queryFn: () =>
      fetchNaacEvidence({
        criterion: evidenceCriterion ? Number(evidenceCriterion) : undefined,
        academicYear: evidenceYear,
        limit: 50,
      }),
    enabled: enabled && page === 'evidence',
  });
  const criteriaQ = useQuery({
    queryKey: ['naac-criteria'],
    queryFn: fetchNaacCriteria,
    enabled: enabled && page === 'criteria',
  });
  const vaultQ = useQuery({
    queryKey: ['naac-vault'],
    queryFn: () => fetchNaacVault({ limit: 50 }),
    enabled: enabled && page === 'vault',
  });
  const aqarsQ = useQuery({
    queryKey: ['naac-aqars'],
    queryFn: fetchNaacAqars,
    enabled: enabled && page === 'aqar',
  });
  const aqarDetailQ = useQuery({
    queryKey: ['naac-aqar', selectedAqarId],
    queryFn: () => fetchNaacAqar(selectedAqarId!),
    enabled: !!selectedAqarId && page === 'aqar',
  });
  const facultyQ = useQuery({
    queryKey: ['naac-faculty'],
    queryFn: () => fetchNaacFacultyAchievements({ limit: 50 }),
    enabled: enabled && page === 'faculty',
  });
  const studentQ = useQuery({
    queryKey: ['naac-student'],
    queryFn: () => fetchNaacStudentAchievements({ limit: 50 }),
    enabled: enabled && page === 'student',
  });
  const mousQ = useQuery({
    queryKey: ['naac-mous'],
    queryFn: fetchNaacMous,
    enabled: enabled && page === 'mous',
  });
  const deptQ = useQuery({
    queryKey: ['naac-dept'],
    queryFn: () => fetchNaacDepartmentDashboard(),
    enabled: enabled && page === 'department',
  });
  const iqacQ = useQuery({
    queryKey: ['naac-iqac'],
    queryFn: fetchNaacIqacSummary,
    enabled: enabled && page === 'iqac',
  });
  const dvvQ = useQuery({
    queryKey: ['naac-dvv'],
    queryFn: () => fetchNaacDvvReadiness(),
    enabled: enabled && page === 'dvv',
  });
  const calendarQ = useQuery({
    queryKey: ['naac-calendar'],
    queryFn: fetchNaacCalendar,
    enabled: enabled && page === 'calendar',
  });
  const settingsQ = useQuery({
    queryKey: ['naac-settings'],
    queryFn: fetchNaacSettings,
    enabled: enabled && page === 'settings',
  });

  const syncMut = useMutation({
    mutationFn: ({ aqarId, sectionKey }: { aqarId: string; sectionKey: string }) =>
      syncNaacAqarSection(aqarId, sectionKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['naac-aqar'] });
      qc.invalidateQueries({ queryKey: ['naac-aqars'] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const vaultMut = useMutation({
    mutationFn: uploadNaacVault,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['naac-vault'] });
      qc.invalidateQueries({ queryKey: ['naac-evidence'] });
      qc.invalidateQueries({ queryKey: ['naac-dashboard'] });
      setVaultUploadKey((k) => k + 1);
      setError('');
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const exportMut = useMutation({
    mutationFn: exportNaacReport,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const dashboard = dashboardQ.data;

  const content = useMemo(() => {
    if (page === 'dashboard') {
      if (dashboardQ.isLoading) return <Loader2 className="h-6 w-6 animate-spin" />;
      if (!dashboard) return <p className="text-muted-foreground">Dashboard unavailable.</p>;
      return (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Overall Readiness</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={cn('text-3xl font-bold', scoreTone(dashboard.overallReadiness))}>
                  {dashboard.overallReadiness}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">AQAR Completion</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{dashboard.aqarCompletionPct}%</p>
                <Badge variant="outline">{dashboard.aqarStatus}</Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Missing Evidence</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-amber-600">
                  {dashboard.pending.missingEvidence}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Dept Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{dashboard.pending.departmentPending}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Criterion-wise Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {dashboard.criterionStatus.map((c) => (
                <CriterionBar
                  key={c.criterion}
                  criterion={c.criterion}
                  title={c.title}
                  score={c.score}
                />
              ))}
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>ERP Aggregates</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(dashboard.aggregates).map(([k, v]) => (
                  <div key={k} className="rounded border p-2">
                    <p className="text-muted-foreground capitalize">{k}</p>
                    <p className="text-xl font-semibold">{v.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Deadlines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashboard.upcomingDeadlines.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between rounded border p-2 text-sm"
                  >
                    <span>{e.title}</span>
                    <Badge variant="outline">{new Date(e.dueDate).toLocaleDateString()}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    if (page === 'criteria') {
      if (criteriaQ.isLoading) return <Loader2 className="h-6 w-6 animate-spin" />;
      return (
        <div className="space-y-4">
          {(criteriaQ.data ?? []).map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  Criterion {c.criterion}: {c.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">{c.description}</p>
                <DataTable
                  rows={(c.metrics ?? []).map((m) => ({
                    code: m.code,
                    title: m.title,
                    type: m.dataType,
                    mandatory: m.isMandatory ? 'Yes' : 'No',
                  }))}
                  columns={['code', 'title', 'type', 'mandatory']}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (page === 'evidence') {
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div>
              <Label>Criterion</Label>
              <Input
                value={evidenceCriterion}
                onChange={(e) => setEvidenceCriterion(e.target.value)}
                placeholder="1-7"
                className="w-24"
              />
            </div>
            <div>
              <Label>Academic Year</Label>
              <Input
                value={evidenceYear}
                onChange={(e) => setEvidenceYear(e.target.value)}
                className="w-32"
              />
            </div>
          </div>
          {evidenceQ.isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {evidenceQ.data?.total ?? 0} documents ({evidenceQ.data?.nimsTotal ?? 0} NIMS +{' '}
                {evidenceQ.data?.governanceTotal ?? 0} governance)
              </p>
              <DataTable
                rows={(evidenceQ.data?.items ?? []).map((t) => ({
                  criterion: t.criterion,
                  metric: t.metricCode ?? '—',
                  year: t.academicYear,
                  activity: t.activityTitle ?? '—',
                  event: t.eventTitle ?? '—',
                  source: t.sourceType,
                  file: t.fileName ?? '—',
                  notes: t.evidenceNotes ? String(t.evidenceNotes).slice(0, 40) : '—',
                  origin: t.origin ?? 'nims',
                }))}
                columns={[
                  'criterion',
                  'metric',
                  'year',
                  'activity',
                  'event',
                  'source',
                  'file',
                  'notes',
                  'origin',
                ]}
              />
            </>
          )}
        </div>
      );
    }

    if (page === 'vault') {
      const defaultYear = dashboardQ.data?.academicYear ?? '2025-26';
      return (
        <div className="space-y-4">
          <EvidenceTagUploadForm
            key={vaultUploadKey}
            defaultAcademicYear={defaultYear}
            isPending={vaultMut.isPending}
            onSubmit={(form) => vaultMut.mutate(form)}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vault documents</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                rows={(vaultQ.data?.items ?? []).map((d) => ({
                  file: d.fileName,
                  date: new Date(d.createdAt).toLocaleDateString(),
                  tags: d.evidenceTags?.length ?? 0,
                  criterion: d.evidenceTags?.[0]?.criterion ?? '—',
                  metric: d.evidenceTags?.[0]?.metricCode ?? '—',
                  year: d.evidenceTags?.[0]?.academicYear ?? '—',
                }))}
                columns={['file', 'criterion', 'metric', 'year', 'tags', 'date']}
              />
            </CardContent>
          </Card>
        </div>
      );
    }

    if (page === 'aqar') {
      const aqars = aqarsQ.data ?? [];
      const detail = aqarDetailQ.data;
      return (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {aqars.map((a) => (
              <Button
                key={a.id}
                variant={selectedAqarId === a.id ? 'default' : 'outline'}
                onClick={() => setSelectedAqarId(a.id)}
              >
                {a.title} ({a.completionPct}%)
              </Button>
            ))}
          </div>
          {detail && (
            <Card>
              <CardHeader>
                <CardTitle>{detail.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(detail.sections ?? []).map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded border p-3">
                    <div>
                      <p className="font-medium">{s.sectionKey}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.completionPct}% ·{' '}
                        {s.lastSyncedAt
                          ? `Synced ${new Date(s.lastSyncedAt).toLocaleString()}`
                          : 'Not synced'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={syncMut.isPending}
                      onClick={() =>
                        syncMut.mutate({ aqarId: detail.id, sectionKey: s.sectionKey })
                      }
                    >
                      Sync from ERP
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      );
    }

    if (page === 'department') {
      const data = deptQ.data as
        | {
            departments?: Array<{ id: string; name: string; code: string }>;
            submissions?: unknown[];
            pendingDepartments?: unknown[];
          }
        | undefined;
      return (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Department NAAC Portal</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {data?.departments?.length ?? 0} departments ·{' '}
                {(data?.pendingDepartments as unknown[])?.length ?? 0} pending submission
              </p>
              <Button
                onClick={() => {
                  const dept = data?.departments?.[0];
                  if (!dept) return;
                  createNaacDepartmentSubmission({
                    departmentId: dept.id,
                    academicYear: '2025-26',
                    submissionType: 'activities',
                    payload: { note: 'Dept activities submitted' },
                  }).then(() => qc.invalidateQueries({ queryKey: ['naac-dept'] }));
                }}
              >
                Submit sample dept data
              </Button>
            </CardContent>
          </Card>
          <DataTable
            rows={(data?.departments ?? []).map((d) => ({ code: d.code, name: d.name }))}
            columns={['code', 'name']}
          />
        </div>
      );
    }

    if (page === 'faculty') {
      return (
        <DataTable
          rows={(facultyQ.data?.items ?? []).map((a) => ({
            type: a.achievementType,
            title: a.title,
            status: a.status,
          }))}
          columns={['type', 'title', 'status']}
        />
      );
    }

    if (page === 'student') {
      return (
        <DataTable
          rows={(studentQ.data?.items ?? []).map((a) => ({
            type: a.achievementType,
            title: a.title,
            status: a.status,
          }))}
          columns={['type', 'title', 'status']}
        />
      );
    }

    if (page === 'mous') {
      return (
        <DataTable
          rows={(mousQ.data ?? []).map((m) => ({
            partner: m.partnerName,
            type: m.partnerType,
            status: m.status,
            activities: m.activities?.length ?? 0,
          }))}
          columns={['partner', 'type', 'status', 'activities']}
        />
      );
    }

    if (page === 'iqac') {
      const iqac = iqacQ.data;
      return (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>IQAC Integration (via Governance)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                IQAC Committee:{' '}
                {iqac?.iqacCommittee?.name ?? 'Not found — seed IQAC committee in Governance'}
              </p>
              <p className="text-sm">Open ATR items: {iqac?.openAtrCount ?? 0}</p>
              <div className="flex flex-wrap gap-2">
                {iqac?.links &&
                  Object.entries(iqac.links).map(([k, href]) => (
                    <Button key={k} asChild variant="outline" size="sm">
                      <Link href={href}>
                        {k} <ExternalLink className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  ))}
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground rounded border border-amber-200 bg-amber-50 p-3 dark:bg-amber-950/30">
            Legacy governance NAAC evidence is still available at{' '}
            <Link href="/admin/governance/naac" className="underline">
              /admin/governance/naac
            </Link>{' '}
            — new evidence should be tagged via NIMS Evidence Repository.
          </p>
        </div>
      );
    }

    if (page === 'dvv') {
      const dvv = dvvQ.data;
      return (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>DVV Readiness — {dvv?.readinessScore ?? 0}%</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="rounded border p-3">
                <p className="text-sm text-muted-foreground">Metrics Missing</p>
                <p className="text-2xl font-bold text-rose-600">{dvv?.documentsMissing ?? 0}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-sm text-muted-foreground">Faculty Pending</p>
                <p className="text-2xl font-bold">{dvv?.facultyPending ?? 0}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-sm text-muted-foreground">Depts Pending</p>
                <p className="text-2xl font-bold">{dvv?.departmentsPending?.length ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <DataTable
            rows={(dvv?.metricsMissing ?? []).map((m) => ({
              code: m.code,
              title: m.title,
              criterion: m.criterion,
            }))}
            columns={['code', 'title', 'criterion']}
          />
        </div>
      );
    }

    if (page === 'calendar') {
      return (
        <DataTable
          rows={(calendarQ.data ?? []).map((e) => ({
            title: e.title,
            type: e.eventType,
            due: new Date(e.dueDate).toLocaleDateString(),
            status: e.status,
          }))}
          columns={['title', 'type', 'due', 'status']}
        />
      );
    }

    if (page === 'reports') {
      return (
        <Card>
          <CardHeader>
            <CardTitle>NAAC Reports & Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              disabled={exportMut.isPending}
              onClick={() =>
                exportMut.mutate({
                  reportType: 'evidence-index',
                  format: 'json',
                  academicYear: '2025-26',
                })
              }
            >
              Export Evidence Index (JSON)
            </Button>
            <Button
              variant="outline"
              disabled={exportMut.isPending}
              onClick={() =>
                exportMut.mutate({
                  reportType: 'evidence-index',
                  format: 'csv',
                  academicYear: '2025-26',
                })
              }
            >
              Export Evidence Index (CSV)
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (page === 'settings') {
      const s = settingsQ.data as { activeAqarYear?: string } | undefined;
      return (
        <Card>
          <CardHeader>
            <CardTitle>NAAC Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Active AQAR Year: <strong>{s?.activeAqarYear ?? '2025-26'}</strong>
            </p>
            <Button
              className="mt-3"
              variant="outline"
              onClick={() =>
                updateNaacSettings({ activeAqarYear: '2025-26' }).then(() =>
                  qc.invalidateQueries({ queryKey: ['naac-settings'] }),
                )
              }
            >
              Save defaults
            </Button>
          </CardContent>
        </Card>
      );
    }

    return null;
  }, [
    page,
    dashboard,
    dashboardQ,
    evidenceQ,
    criteriaQ,
    vaultQ,
    aqarsQ,
    aqarDetailQ,
    facultyQ,
    studentQ,
    mousQ,
    deptQ,
    iqacQ,
    dvvQ,
    calendarQ,
    settingsQ,
    evidenceCriterion,
    evidenceYear,
    vaultUploadKey,
    syncMut,
    vaultMut,
    exportMut,
    qc,
    selectedAqarId,
  ]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30">
          <AlertTriangle className="inline mr-2 h-4 w-4" />
          {error}
        </div>
      )}
      {page === 'dashboard' && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Award className="h-5 w-5" />
          <span className="text-sm">
            NAAC Accreditation & IQAC Management System — continuous evidence collection
          </span>
        </div>
      )}
      {content}
    </div>
  );
}
