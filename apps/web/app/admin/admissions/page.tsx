'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { motion } from 'framer-motion';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFormDraft } from '@/hooks/use-form-draft';
import { useRequireAuth } from '@/hooks/use-auth';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { fetchAcademicStreams } from '@/services/academic-engine';
import { fetchPrograms } from '@/services/programs';
import { fetchAcademicYears } from '@/services/organization';
import {
  createApplication,
  createIntake,
  fetchAdmissionsSummary,
  fetchAllocations,
  fetchApplications,
  fetchIntakes,
  fetchMeritList,
  fetchMeritLists,
  generateMeritList,
  publishMeritList,
  runSeatAllocation,
  updateAllocationStatus,
  updateApplicationStatus,
} from '@/services/admissions';
import type { AdmissionApplication } from '@/types/admissions';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { enrollStudentFromApplication } from '@/services/students';

type TabId = 'overview' | 'intakes' | 'applications' | 'merit' | 'allocations';

const CATEGORIES = ['GENERAL', 'OBC', 'SC', 'ST', 'EWS'] as const;
const APP_STATUSES = ['submitted', 'under_review', 'shortlisted', 'rejected', 'allotted'] as const;

const intakeSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  programId: z.string().uuid(),
  academicYearId: z.string().uuid().optional().or(z.literal('')),
  totalSeats: z.number().int().positive(),
});

type IntakeFormValues = {
  name: string;
  code: string;
  programId: string;
  academicYearId?: string;
  totalSeats: number;
};

const applicationSchema = z.object({
  intakeId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  category: z.enum(CATEGORIES),
  meritScore: z.number().positive(),
  academicStreamId: z.string().uuid(),
});

type ApplicationFormValues = z.infer<typeof applicationSchema>;

const selectClass = 'h-10 w-full rounded-md border border-border bg-card px-3 text-sm';

export default function AdminAdmissionsPage() {
  const session = useRequireAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>('overview');
  const [selectedIntakeId, setSelectedIntakeId] = useState('');
  const [selectedMeritListId, setSelectedMeritListId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const summary = useQuery({
    queryKey: ['admissions', 'summary'],
    queryFn: fetchAdmissionsSummary,
    enabled: Boolean(session),
  });

  const intakes = useQuery({
    queryKey: ['admissions', 'intakes'],
    queryFn: fetchIntakes,
    enabled: Boolean(session),
  });

  const programs = useQuery({
    queryKey: ['catalog', 'programs'],
    queryFn: () => fetchPrograms(1),
    enabled: Boolean(session),
  });

  const academicYears = useQuery({
    queryKey: ['org', 'academic-years'],
    queryFn: fetchAcademicYears,
    enabled: Boolean(session),
  });

  const academicStreams = useQuery({
    queryKey: ['academic-engine', 'streams'],
    queryFn: fetchAcademicStreams,
    enabled: Boolean(session),
  });

  const applications = useQuery({
    queryKey: ['admissions', 'applications', selectedIntakeId, statusFilter],
    queryFn: () =>
      fetchApplications({
        limit: 50,
        intakeId: selectedIntakeId || undefined,
        status: statusFilter || undefined,
      }),
    enabled: Boolean(session),
  });

  const meritLists = useQuery({
    queryKey: ['admissions', 'merit-lists', selectedIntakeId],
    queryFn: () => fetchMeritLists(selectedIntakeId || undefined),
    enabled: Boolean(session),
  });

  const meritDetail = useQuery({
    queryKey: ['admissions', 'merit-list', selectedMeritListId],
    queryFn: () => fetchMeritList(selectedMeritListId),
    enabled: Boolean(session) && Boolean(selectedMeritListId),
  });

  const allocations = useQuery({
    queryKey: ['admissions', 'allocations', selectedIntakeId],
    queryFn: () => fetchAllocations(selectedIntakeId || undefined),
    enabled: Boolean(session),
  });

  const canManage = useMemo(() => session?.user.roles.includes('college-admin'), [session]);

  const intakeForm = useForm<IntakeFormValues>({
    resolver: zodResolver(intakeSchema),
    defaultValues: { name: '', code: '', programId: '', academicYearId: '', totalSeats: 60 },
  });

  const applicationForm = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      intakeId: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      category: 'GENERAL',
      meritScore: 75,
      academicStreamId: '',
    },
  });

  const intakeFormValues = useWatch({ control: intakeForm.control }) as IntakeFormValues;
  const applicationFormValues = useWatch({
    control: applicationForm.control,
  }) as ApplicationFormValues;
  const tenantId = session?.user.tenantId ?? 'tenant';
  const { clearDraft: clearIntakeDraft } = useFormDraft({
    keyParts: ['admission-intake-draft', tenantId, 'new'],
    values: intakeFormValues,
    enabled: Boolean(session) && tab === 'intakes',
    onRestore: (data) => intakeForm.reset(data),
  });
  const { clearDraft: clearApplicationDraft } = useFormDraft({
    keyParts: ['admission-application-draft', tenantId, 'new'],
    values: applicationFormValues,
    enabled: Boolean(session) && tab === 'applications',
    onRestore: (data) => applicationForm.reset(data),
  });
  useUnsavedChangesGuard({
    isDirty: intakeForm.formState.isDirty,
    enabled: tab === 'intakes',
  });
  useUnsavedChangesGuard({
    isDirty: applicationForm.formState.isDirty,
    enabled: tab === 'applications',
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admissions'] });

  const createIntakeMut = useMutation({
    mutationFn: (v: IntakeFormValues) =>
      createIntake({
        ...v,
        academicYearId: v.academicYearId || undefined,
      }),
    onSuccess: () => {
      intakeForm.reset();
      clearIntakeDraft();
      invalidate();
    },
  });

  const createAppMut = useMutation({
    mutationFn: (v: ApplicationFormValues) => createApplication(v),
    onSuccess: () => {
      applicationForm.reset({
        intakeId: applicationForm.getValues('intakeId'),
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        category: 'GENERAL',
        meritScore: 75,
      });
      clearApplicationDraft();
      invalidate();
    },
  });

  const updateStatusMut = useMutation({
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

  const generateMeritMut = useMutation({
    mutationFn: (intakeId: string) => generateMeritList({ intakeId, round: 1 }),
    onSuccess: (data) => {
      setSelectedMeritListId(data?.id ?? '');
      invalidate();
    },
  });

  const publishMeritMut = useMutation({
    mutationFn: publishMeritList,
    onSuccess: invalidate,
  });

  const runAllocationMut = useMutation({
    mutationFn: ({ intakeId, meritListId }: { intakeId: string; meritListId: string }) =>
      runSeatAllocation({ intakeId, meritListId }),
    onSuccess: invalidate,
  });

  const confirmAllocMut = useMutation({
    mutationFn: (id: string) => updateAllocationStatus(id, 'confirmed'),
    onSuccess: invalidate,
  });

  if (!session) return null;

  const publishedMerit = meritLists.data?.find((m) => m.status === 'published');

  return (
    <DashboardShell role="admin" title="Admissions">
      <div className="space-y-6 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border/80 bg-gradient-to-r from-primary/5 via-card to-accent/5 p-4 md:p-5"
        >
          <p className="text-sm text-muted-foreground">Admissions workspace</p>
          <h2 className="text-xl font-semibold tracking-tight">
            Applications, merit lists & seat allocation
          </h2>
        </motion.div>

        <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-card/50 p-2">
          <TabBtn tab={tab} id="overview" label="Overview" onClick={setTab} />
          <TabBtn tab={tab} id="intakes" label="Intakes" onClick={setTab} />
          <TabBtn tab={tab} id="applications" label="Applications" onClick={setTab} />
          <TabBtn tab={tab} id="merit" label="Merit lists" onClick={setTab} />
          <TabBtn tab={tab} id="allocations" label="Seat allocation" onClick={setTab} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Label className="sr-only">Filter by intake</Label>
          <select
            className={cn(selectClass, 'max-w-xs')}
            value={selectedIntakeId}
            onChange={(e) => {
              setSelectedIntakeId(e.target.value);
              setSelectedMeritListId('');
            }}
          >
            <option value="">All intakes</option>
            {(intakes.data ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.code} — {i.name}
              </option>
            ))}
          </select>
        </div>

        {tab === 'overview' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Intakes" value={summary.data?.intakes} />
            <Stat label="Applications" value={summary.data?.applications} />
            <Stat label="Pending review" value={summary.data?.pendingReview} />
            <Stat label="Published merit lists" value={summary.data?.publishedMeritLists} />
            <Stat label="Active allocations" value={summary.data?.activeAllocations} />
          </div>
        ) : null}

        {tab === 'intakes' ? (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle>Create intake</CardTitle>
                <CardDescription>Admission cycle for a program</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={intakeForm.handleSubmit((v) => createIntakeMut.mutate(v))}
                >
                  <Field label="Name">
                    <Input
                      placeholder="BCA Admission 2026"
                      {...intakeForm.register('name')}
                      disabled={!canManage}
                    />
                  </Field>
                  <Field label="Code">
                    <Input
                      placeholder="BCA-2026"
                      {...intakeForm.register('code')}
                      disabled={!canManage}
                    />
                  </Field>
                  <Field label="Program">
                    <select
                      className={selectClass}
                      {...intakeForm.register('programId')}
                      disabled={!canManage}
                    >
                      <option value="">Select</option>
                      {(programs.data?.data ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} — {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Academic year">
                    <select
                      className={selectClass}
                      {...intakeForm.register('academicYearId')}
                      disabled={!canManage}
                    >
                      <option value="">Optional</option>
                      {(academicYears.data ?? []).map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Total seats">
                    <Input
                      type="number"
                      {...intakeForm.register('totalSeats', { valueAsNumber: true })}
                      disabled={!canManage}
                    />
                  </Field>
                  {createIntakeMut.error ? (
                    <p className="text-sm text-destructive" role="alert">
                      {apiErrorMessage(createIntakeMut.error, 'Could not create intake')}
                    </p>
                  ) : null}
                  <Button type="submit" disabled={!canManage || createIntakeMut.isPending}>
                    {createIntakeMut.isPending ? 'Creating…' : 'Create intake'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle>Active intakes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(intakes.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No intakes yet.</p>
                ) : (
                  intakes.data?.map((i) => (
                    <div key={i.id} className="rounded-xl border border-border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {i.code} — {i.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {i.program.code} · {i._count.applications} applications ·{' '}
                            {i._count.allocations}/{i.totalSeats} seats filled
                          </p>
                        </div>
                        <StatusBadge status={i.status} />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {tab === 'applications' ? (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle>New application</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={applicationForm.handleSubmit((v) => createAppMut.mutate(v))}
                >
                  <Field label="Intake">
                    <select
                      className={selectClass}
                      {...applicationForm.register('intakeId')}
                      disabled={!canManage}
                    >
                      <option value="">Select intake</option>
                      {(intakes.data ?? []).map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.code}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First name">
                      <Input {...applicationForm.register('firstName')} disabled={!canManage} />
                    </Field>
                    <Field label="Last name">
                      <Input {...applicationForm.register('lastName')} disabled={!canManage} />
                    </Field>
                  </div>
                  <Field label="Email">
                    <Input
                      type="email"
                      {...applicationForm.register('email')}
                      disabled={!canManage}
                    />
                  </Field>
                  <Field label="Merit score">
                    <Input
                      type="number"
                      step="0.1"
                      {...applicationForm.register('meritScore', { valueAsNumber: true })}
                      disabled={!canManage}
                    />
                  </Field>
                  <Field label="Academic stream">
                    <select
                      className={selectClass}
                      {...applicationForm.register('academicStreamId')}
                      disabled={!canManage}
                    >
                      <option value="">Select stream</option>
                      {(academicStreams.data ?? []).map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.code})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Category">
                    <select
                      className={selectClass}
                      {...applicationForm.register('category')}
                      disabled={!canManage}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {createAppMut.error ? (
                    <p className="text-sm text-destructive" role="alert">
                      {apiErrorMessage(createAppMut.error, 'Could not submit application')}
                    </p>
                  ) : null}
                  <Button type="submit" disabled={!canManage || createAppMut.isPending}>
                    Submit application
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="glass-card border-0">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle>Applications</CardTitle>
                <select
                  className={cn(selectClass, 'max-w-[160px]')}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All statuses</option>
                  {APP_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </CardHeader>
              <CardContent className="space-y-2">
                {(applications.data?.data ?? []).map((app) => (
                  <ApplicationRow
                    key={app.id}
                    app={app}
                    canManage={Boolean(canManage)}
                    enrolling={enrollMut.isPending && enrollMut.variables === app.id}
                    onStatus={(status) => updateStatusMut.mutate({ id: app.id, status })}
                    onEnroll={() => enrollMut.mutate(app.id)}
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {tab === 'merit' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card border-0">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Merit lists</CardTitle>
                  <CardDescription>Generate from merit scores, then publish</CardDescription>
                </div>
                {selectedIntakeId && canManage ? (
                  <Button
                    size="sm"
                    disabled={generateMeritMut.isPending}
                    onClick={() => generateMeritMut.mutate(selectedIntakeId)}
                  >
                    Generate
                  </Button>
                ) : null}
              </CardHeader>
              {generateMeritMut.error ? (
                <p className="px-6 pb-2 text-sm text-destructive" role="alert">
                  {apiErrorMessage(generateMeritMut.error, 'Could not generate merit list')}
                </p>
              ) : null}
              <CardContent className="space-y-2">
                {(meritLists.data ?? []).map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => setSelectedMeritListId(list.id)}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left transition',
                      selectedMeritListId === list.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/40',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{list.name}</p>
                      <StatusBadge status={list.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Round {list.round} · {list._count.entries} candidates
                    </p>
                    {list.status === 'draft' && canManage ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        disabled={publishMeritMut.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          publishMeritMut.mutate(list.id);
                        }}
                      >
                        Publish
                      </Button>
                    ) : null}
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle>Merit ranking</CardTitle>
                <CardDescription>
                  {meritDetail.data
                    ? `${meritDetail.data.entries.length} ranked applicants`
                    : 'Select a merit list'}
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[480px] space-y-1 overflow-y-auto">
                {(meritDetail.data?.entries ?? []).map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <span className="font-mono text-muted-foreground">#{e.rank}</span>
                    <span className="flex-1 px-3">
                      {e.application.firstName} {e.application.lastName}
                    </span>
                    <span className="font-medium">{String(e.score)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {tab === 'allocations' ? (
          <Card className="glass-card border-0">
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Seat allocation</CardTitle>
                <CardDescription>Run allocation from a published merit list</CardDescription>
              </div>
              {selectedIntakeId && publishedMerit && canManage ? (
                <Button
                  disabled={runAllocationMut.isPending}
                  onClick={() =>
                    runAllocationMut.mutate({
                      intakeId: selectedIntakeId,
                      meritListId: publishedMerit.id,
                    })
                  }
                >
                  Run allocation
                </Button>
              ) : null}
            </CardHeader>
            {runAllocationMut.error ? (
              <p className="px-6 pb-2 text-sm text-destructive" role="alert">
                {apiErrorMessage(runAllocationMut.error, 'Seat allocation failed')}
              </p>
            ) : null}
            <CardContent className="space-y-2">
              {(allocations.data ?? []).map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {a.application.applicationNumber} — {a.application.firstName}{' '}
                      {a.application.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.intake.name} · Round {a.round}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={a.status} />
                    {a.status === 'provisional' && canManage ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => confirmAllocMut.mutate(a.id)}
                      >
                        Confirm
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardShell>
  );
}

function ApplicationRow({
  app,
  canManage,
  onStatus,
  onEnroll,
  enrolling,
}: {
  app: AdmissionApplication;
  canManage: boolean;
  onStatus: (status: string) => void;
  onEnroll?: () => void;
  enrolling?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {app.applicationNumber} — {app.firstName} {app.lastName}
          </p>
          <p className="text-xs text-muted-foreground">
            {app.email} · {app.category} · Score {app.meritScore}
          </p>
        </div>
        <StatusBadge status={app.status} />
      </div>
      {canManage ? (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {app.status === 'allotted' ? (
            <Button size="sm" disabled={enrolling} onClick={onEnroll}>
              {enrolling ? 'Enrolling…' : 'Enroll as student'}
            </Button>
          ) : null}
          {(['under_review', 'shortlisted', 'rejected', 'allotted'] as const).map((s) => (
            <Button key={s} size="sm" variant="outline" onClick={() => onStatus(s)}>
              {s.replace('_', ' ')}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TabBtn({
  tab,
  id,
  label,
  onClick,
}: {
  tab: TabId;
  id: TabId;
  label: string;
  onClick: (id: TabId) => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={tab === id ? 'default' : 'outline'}
      onClick={() => onClick(id)}
    >
      {label}
    </Button>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value ?? '—'}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-success/10 text-success',
    closed: 'bg-muted text-muted-foreground',
    draft: 'bg-warning/10 text-warning',
    published: 'bg-primary/10 text-primary',
    submitted: 'bg-muted text-muted-foreground',
    under_review: 'bg-warning/10 text-warning',
    shortlisted: 'bg-primary/10 text-primary',
    rejected: 'bg-danger/10 text-danger',
    allotted: 'bg-success/10 text-success',
    provisional: 'bg-warning/10 text-warning',
    confirmed: 'bg-success/10 text-success',
    withdrawn: 'bg-muted text-muted-foreground',
  };

  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        styles[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
