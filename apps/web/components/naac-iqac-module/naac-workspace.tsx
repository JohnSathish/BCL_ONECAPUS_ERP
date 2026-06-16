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
  downloadNaacEvidencePack,
  exportNaacReport,
  fetchNaacCriteria,
  fetchNaacDashboard,
  fetchNaacDepartmentDashboard,
  fetchNaacPortalDepartment,
  fetchNaacDvvReadiness,
  fetchNaacEvidence,
  fetchNaacIqacSummary,
  fetchNaacVault,
  uploadNaacVault,
} from '@/services/naac-iqac';
import type { NaacPage } from '@/types/naac-iqac';
import { EvidenceTagUploadForm } from '@/components/naac-iqac-module/evidence-tag-upload-form';
import { NaacAqarPanel } from '@/components/naac-iqac-module/naac-aqar-panel';
import { NaacCalendarPanel } from '@/components/naac-iqac-module/naac-calendar-panel';
import { NaacDepartmentPanel } from '@/components/naac-iqac-module/naac-department-panel';
import { NaacFacultyPanel } from '@/components/naac-iqac-module/naac-faculty-panel';
import { NaacMouPanel } from '@/components/naac-iqac-module/naac-mou-panel';
import { NaacSettingsPanel } from '@/components/naac-iqac-module/naac-settings-panel';
import { NaacStudentPanel } from '@/components/naac-iqac-module/naac-student-panel';
import { downloadBlob } from '@/utils/download-blob';
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

export function NaacWorkspace({
  page,
  portalMode = false,
}: {
  page: NaacPage;
  portalMode?: boolean;
}) {
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
  const deptQ = useQuery({
    queryKey: ['naac-dept', portalMode],
    queryFn: () => (portalMode ? fetchNaacPortalDepartment() : fetchNaacDepartmentDashboard()),
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

  const vaultMut = useMutation({
    mutationFn: uploadNaacVault,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['naac-vault'] });
      qc.invalidateQueries({ queryKey: ['naac-evidence'] });
      qc.invalidateQueries({ queryKey: ['naac-dashboard'] });
      setVaultUploadKey((k) => k + 1);
      setError('');
    },
    onError: (e) => setError(apiErrorMessage(e, 'Upload failed')),
  });

  const exportMut = useMutation({
    mutationFn: exportNaacReport,
    onError: (e) => setError(apiErrorMessage(e, 'Upload failed')),
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
                  event: t.activityTitle ?? '—',
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
      return <NaacAqarPanel selectedId={selectedAqarId} onSelect={setSelectedAqarId} />;
    }

    if (page === 'department') {
      return <NaacDepartmentPanel data={deptQ.data} canReview={!portalMode} />;
    }

    if (page === 'faculty') {
      return <NaacFacultyPanel portalMode={portalMode} canReview={!portalMode} />;
    }

    if (page === 'student') {
      return <NaacStudentPanel canReview={!portalMode} />;
    }

    if (page === 'mous') {
      return <NaacMouPanel />;
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
      return <NaacCalendarPanel />;
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
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const res = await downloadNaacEvidencePack({ academicYear: '2025-26' });
                  downloadBlob(res.data, 'naac-evidence-pack.zip');
                } catch (e) {
                  setError(apiErrorMessage(e, 'ZIP export failed'));
                }
              }}
            >
              Download Evidence Pack (ZIP)
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (page === 'settings') {
      return <NaacSettingsPanel />;
    }

    return null;
  }, [
    page,
    dashboard,
    dashboardQ,
    evidenceQ,
    criteriaQ,
    vaultQ,
    deptQ,
    iqacQ,
    dvvQ,
    evidenceCriterion,
    evidenceYear,
    vaultUploadKey,
    vaultMut,
    exportMut,
    portalMode,
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
