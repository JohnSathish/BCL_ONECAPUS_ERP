'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AdmissionsApplicationReviewPanel } from '@/components/admissions-module/admissions-application-review-panel';
import {
  admissionFeeLabel,
  applicationDisplayMeta,
  applicationFeeLabel,
  applicationFormProgressLabel,
  applicationRowTone,
} from '@/components/admissions-module/admissions-control-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  fetchApplications,
  fetchCycles,
  fetchIntakes,
  sendAdmissionOffer,
  updateApplicationStatus,
  downloadApplicationPdf,
} from '@/services/admissions';
import { enrollStudentFromApplication } from '@/services/students';
import type { AdmissionApplication } from '@/types/admissions';
import { canManageAdmissions } from '@/lib/can-manage-academic';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

export type AdmissionsControlPreset = {
  title: string;
  description: string;
  status?: string;
  paymentPending?: boolean;
  documentPending?: boolean;
  admissionFeePending?: boolean;
  admittedOnly?: boolean;
};

type Props = {
  preset?: AdmissionsControlPreset;
};

const selectClass = 'h-10 w-full rounded-md border border-border bg-card px-3 text-sm';

export function AdmissionsApplicationsControlCenter({ preset }: Props) {
  const session = useRequireAuth();
  const router = useRouter();
  const qc = useQueryClient();

  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [selectedIntakeId, setSelectedIntakeId] = useState('');
  const [statusFilter, setStatusFilter] = useState(preset?.status ?? '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);

  const canManage = canManageAdmissions(session);

  const cycles = useQuery({
    queryKey: ['admissions', 'cycles'],
    queryFn: () => fetchCycles(),
    enabled: Boolean(session),
  });

  const intakes = useQuery({
    queryKey: ['admissions', 'intakes'],
    queryFn: fetchIntakes,
    enabled: Boolean(session),
  });

  const applications = useQuery({
    queryKey: [
      'admissions',
      'applications',
      'control',
      selectedIntakeId,
      selectedCycleId,
      statusFilter,
      search,
      page,
      preset?.paymentPending,
      preset?.documentPending,
      preset?.admissionFeePending,
      preset?.admittedOnly,
    ],
    queryFn: () =>
      fetchApplications({
        page,
        limit: 25,
        intakeId: selectedIntakeId || undefined,
        cycleId: selectedCycleId || undefined,
        status: preset?.admittedOnly ? 'allotted' : statusFilter || undefined,
        search: search.trim() || undefined,
        paymentPending: preset?.paymentPending,
        documentPending: preset?.documentPending,
        admissionFeePending: preset?.admissionFeePending,
      }),
    enabled: Boolean(session),
  });

  const rows = useMemo(() => {
    const data = applications.data?.data ?? [];
    if (!preset?.admittedOnly) return data;
    return data.filter(
      (app) => app.status === 'allotted' || app.enrolledStudent?.id || app.seatAllocations?.length,
    );
  }, [applications.data?.data, preset?.admittedOnly]);

  const selectedApplication = useMemo(
    () => rows.find((a) => a.id === selectedApplicationId) ?? null,
    [rows, selectedApplicationId],
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admissions'] });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateApplicationStatus(id, status),
    onSuccess: invalidate,
  });

  const enrollMut = useMutation({
    mutationFn: (applicationId: string) => enrollStudentFromApplication(applicationId),
    onSuccess: (student) => {
      invalidate();
      router.push(`/admin/students/${student.id}?section=basic`);
    },
  });

  const offerMut = useMutation({
    mutationFn: sendAdmissionOffer,
    onSuccess: invalidate,
  });

  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  const title = preset?.title ?? 'Applications';
  const description =
    preset?.description ?? 'Review applicant forms, fees, documents, and take admission decisions.';

  return (
    <DashboardShell role="admin" title={title}>
      <div className="space-y-4 pb-8">
        <div className="rounded-2xl border border-border/80 bg-gradient-to-r from-primary/5 via-card to-accent/5 p-4 md:p-5">
          <p className="text-sm text-muted-foreground">Online admission</p>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>

        <Card className="glass-card border-0">
          <CardHeader className="space-y-4 pb-2">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <Label className="text-xs">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Application #, name, email…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
              <FilterSelect
                label="Cycle"
                value={selectedCycleId}
                onChange={(v) => {
                  setSelectedCycleId(v);
                  setPage(1);
                }}
              >
                <option value="">All cycles</option>
                {(cycles.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                label="Intake"
                value={selectedIntakeId}
                onChange={(v) => {
                  setSelectedIntakeId(v);
                  setPage(1);
                }}
              >
                <option value="">All intakes</option>
                {(intakes.data ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code} — {i.name}
                  </option>
                ))}
              </FilterSelect>
              {!preset?.admittedOnly && !preset?.paymentPending && !preset?.documentPending ? (
                <FilterSelect
                  label="Status"
                  value={statusFilter}
                  onChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  {[
                    'draft',
                    'submitted',
                    'under_review',
                    'shortlisted',
                    'allotted',
                    'rejected',
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </option>
                  ))}
                </FilterSelect>
              ) : null}
              {selectedCycleId ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/admissions/cycles/${selectedCycleId}`}>Cycle settings</Link>
                </Button>
              ) : null}
            </div>
            <CardDescription>
              {applications.data?.meta.total ?? 0} applications
              {applications.isFetching ? ' · Loading…' : ''}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Applicant</th>
                    <th className="px-3 py-3">Major / stream</th>
                    <th className="px-3 py-3">Shift</th>
                    <th className="px-3 py-3">Score</th>
                    <th className="px-3 py-3">Progress & fees</th>
                    <th className="px-3 py-3">Submitted</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        No applications match the current filters.
                      </td>
                    </tr>
                  ) : (
                    rows.map((app) => (
                      <ApplicationTableRow
                        key={app.id}
                        app={app}
                        selected={selectedApplicationId === app.id}
                        canManage={canManage}
                        onSelect={() => setSelectedApplicationId(app.id)}
                        onApprove={() => statusMut.mutate({ id: app.id, status: 'shortlisted' })}
                        onReject={() => statusMut.mutate({ id: app.id, status: 'rejected' })}
                        onDirectAdmission={() =>
                          statusMut.mutate({ id: app.id, status: 'allotted' })
                        }
                        onEnroll={() => enrollMut.mutate(app.id)}
                        onSendOffer={() => offerMut.mutate(app.id)}
                        onDownloadPdf={async () => {
                          setPdfLoadingId(app.id);
                          try {
                            await downloadApplicationPdf(app.id, app.applicationNumber);
                          } finally {
                            setPdfLoadingId(null);
                          }
                        }}
                        pdfLoading={pdfLoadingId === app.id}
                        offerPending={offerMut.isPending}
                        busy={statusMut.isPending || enrollMut.isPending}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {applications.data && applications.data.meta.totalPages > 1 ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Page {applications.data.meta.page} of {applications.data.meta.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= applications.data.meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {selectedApplication ? (
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="text-base">Application review</CardTitle>
              <CardDescription>
                Full form, documents, payment references, and workflow for{' '}
                {selectedApplication.applicationNumber}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdmissionsApplicationReviewPanel
                application={selectedApplication}
                canManage={canManage}
                enrolling={enrollMut.isPending && enrollMut.variables === selectedApplication.id}
                onEnroll={() => enrollMut.mutate(selectedApplication.id)}
              />
            </CardContent>
          </Card>
        ) : null}

        {statusMut.error ? (
          <p className="text-sm text-destructive" role="alert">
            {apiErrorMessage(statusMut.error, 'Status update failed')}
          </p>
        ) : null}
      </div>
    </DashboardShell>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-[160px]">
      <Label className="text-xs">{label}</Label>
      <select
        className={cn(selectClass, 'mt-1')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  );
}

function ApplicationTableRow({
  app,
  selected,
  canManage,
  onSelect,
  onApprove,
  onReject,
  onDirectAdmission,
  onEnroll,
  onSendOffer,
  onDownloadPdf,
  pdfLoading,
  offerPending,
  busy,
}: {
  app: AdmissionApplication;
  selected: boolean;
  canManage: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDirectAdmission: () => void;
  onEnroll: () => void;
  onSendOffer: () => void;
  onDownloadPdf: () => void;
  pdfLoading?: boolean;
  offerPending?: boolean;
  busy: boolean;
}) {
  const meta = applicationDisplayMeta(app);
  const tone = applicationRowTone(app);
  const formProgress = applicationFormProgressLabel(app);
  const appFee = applicationFeeLabel(app);
  const admFee = admissionFeeLabel(app);
  const submitted = app.status !== 'draft';

  return (
    <tr
      className={cn(
        'border-t border-border transition-colors',
        tone === 'success' && 'bg-emerald-50/70',
        selected && 'bg-primary/5',
        'hover:bg-muted/30',
      )}
    >
      <td className="px-3 py-3">
        <button type="button" onClick={onSelect} className="flex items-center gap-3 text-left">
          {meta.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={meta.photo}
              alt=""
              className="h-10 w-10 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs font-bold">
              {meta.name.charAt(0)}
            </div>
          )}
          <div>
            <p className="font-mono text-xs font-semibold text-primary">{app.applicationNumber}</p>
            <p className="font-medium text-foreground">{meta.name}</p>
          </div>
        </button>
      </td>
      <td className="px-3 py-3">
        <p className="font-medium uppercase tracking-wide">{meta.major}</p>
        <p className="text-xs text-muted-foreground">{app.category}</p>
      </td>
      <td className="px-3 py-3 text-muted-foreground">{meta.shift}</td>
      <td className="px-3 py-3 font-medium">{meta.percentage}%</td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          {formProgress ? <Badge tone="info">{formProgress}</Badge> : null}
          {appFee ? (
            <Badge tone={appFee.includes('paid') ? 'success' : 'danger'}>{appFee}</Badge>
          ) : null}
          {submitted ? <Badge tone="info">Submitted</Badge> : null}
          {admFee ? (
            <Badge tone={admFee.includes('paid') ? 'success' : 'danger'}>{admFee}</Badge>
          ) : null}
          <Badge tone="muted">{app.documentVerificationStatus ?? 'Docs pending'}</Badge>
        </div>
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">
        {meta.submittedAt
          ? new Date(meta.submittedAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : '—'}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={onSelect}>
            View
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pdfLoading}
            onClick={() => void onDownloadPdf()}
          >
            {pdfLoading ? 'PDF…' : 'PDF'}
          </Button>
          {canManage && (app.status === 'shortlisted' || app.status === 'allotted') ? (
            <Button size="sm" variant="outline" disabled={offerPending} onClick={onSendOffer}>
              Send offer
            </Button>
          ) : null}
          {canManage && submitted && app.status !== 'rejected' && app.status !== 'allotted' ? (
            <>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={busy}
                onClick={onApprove}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                disabled={busy}
                onClick={onReject}
              >
                Reject
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={onDirectAdmission}>
                Direct admission
              </Button>
            </>
          ) : null}
          {canManage && app.status === 'allotted' && !app.enrolledStudent?.id ? (
            <Button size="sm" disabled={busy} onClick={onEnroll}>
              Enroll
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'success' | 'danger' | 'info' | 'muted';
}) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        tone === 'success' && 'bg-emerald-100 text-emerald-800',
        tone === 'danger' && 'bg-rose-100 text-rose-800',
        tone === 'info' && 'bg-sky-100 text-sky-800',
        tone === 'muted' && 'bg-muted text-muted-foreground',
      )}
    >
      {children}
    </span>
  );
}
