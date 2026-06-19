'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFormDraft } from '@/hooks/use-form-draft';
import { useRequireAuth } from '@/hooks/use-auth';
import { canManageAdmissions } from '@/lib/can-manage-academic';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { fetchPrograms } from '@/services/programs';
import { fetchAcademicYears } from '@/services/organization';
import { createIntake, fetchIntakes } from '@/services/admissions';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const intakeSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  programId: z.string().uuid(),
  academicYearId: z.string().uuid().optional().or(z.literal('')),
  totalSeats: z.number().int().positive(),
});

type IntakeFormValues = z.infer<typeof intakeSchema>;

const selectClass = 'h-10 w-full rounded-md border border-border bg-card px-3 text-sm';

export function AdmissionsIntakesWorkspace() {
  const session = useRequireAuth();
  const qc = useQueryClient();
  const canManage = canManageAdmissions(session);

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

  const intakeForm = useForm<IntakeFormValues>({
    resolver: zodResolver(intakeSchema),
    defaultValues: { name: '', code: '', programId: '', academicYearId: '', totalSeats: 60 },
  });

  const intakeFormValues = useWatch({ control: intakeForm.control }) as IntakeFormValues;
  const tenantId = session?.user.tenantId ?? 'tenant';

  const { clearDraft: clearIntakeDraft } = useFormDraft({
    keyParts: ['admission-intake-draft', tenantId, 'new'],
    values: intakeFormValues,
    enabled: Boolean(session),
    onRestore: (data) => intakeForm.reset(data),
  });

  useUnsavedChangesGuard({
    isDirty: intakeForm.formState.isDirty,
    enabled: true,
  });

  const createIntakeMut = useMutation({
    mutationFn: (v: IntakeFormValues) =>
      createIntake({
        ...v,
        academicYearId: v.academicYearId || undefined,
      }),
    onSuccess: () => {
      intakeForm.reset();
      clearIntakeDraft();
      qc.invalidateQueries({ queryKey: ['admissions'] });
    },
  });

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Intakes">
      <div className="grid gap-6 pb-8 lg:grid-cols-[360px_1fr]">
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
                <Input {...intakeForm.register('name')} disabled={!canManage} />
              </Field>
              <Field label="Code">
                <Input {...intakeForm.register('code')} disabled={!canManage} />
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
    </DashboardShell>
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
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        status === 'open' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
      )}
    >
      {status}
    </span>
  );
}
