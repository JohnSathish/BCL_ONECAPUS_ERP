'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  archiveAdmissionCycle,
  cloneAdmissionCycle,
  fetchCycles,
  previewCycleClone,
  publishCycle,
  type AdmissionCycle,
} from '@/services/admissions';
import { fetchAcademicYears } from '@/services/organization';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const STEPS = ['Source', 'Academic year', 'Defaults', 'Dates & fees', 'Confirm'] as const;

type YearMode = 'existing' | 'create';

function toIsoLocal(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function defaultYearBounds(name: string): { startDate: string; endDate: string } {
  const y = Number(name.match(/(\d{4})/)?.[1] ?? new Date().getFullYear() + 1);
  return {
    startDate: `${y}-06-01`,
    endDate: `${y + 1}-05-31`,
  };
}

export function AdmissionsCycleCloneWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [doneCycleId, setDoneCycleId] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState('');

  const [sourceCycleId, setSourceCycleId] = useState('');
  const [yearMode, setYearMode] = useState<YearMode>('create');
  const [academicYearId, setAcademicYearId] = useState('');
  const [newYearName, setNewYearName] = useState('');
  const [newYearStart, setNewYearStart] = useState('');
  const [newYearEnd, setNewYearEnd] = useState('');

  const [prefixOverride, setPrefixOverride] = useState('');
  const [registrationOpensAt, setRegistrationOpensAt] = useState('');
  const [registrationClosesAt, setRegistrationClosesAt] = useState('');
  const [applicationDeadline, setApplicationDeadline] = useState('');
  const [paymentDeadline, setPaymentDeadline] = useState('');
  const [applicationFee, setApplicationFee] = useState('600');
  const [admissionFeeMin, setAdmissionFeeMin] = useState('10500');
  const [helpPhone, setHelpPhone] = useState('');
  const [helpEmail, setHelpEmail] = useState('');
  const [archiveSource, setArchiveSource] = useState(true);
  const [publishNow, setPublishNow] = useState(false);

  const cyclesQuery = useQuery({
    queryKey: ['admission-cycles'],
    queryFn: () => fetchCycles(),
    enabled: open,
  });

  const yearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => fetchAcademicYears(),
    enabled: open,
  });

  const sourceCycles = useMemo(() => {
    const list = (cyclesQuery.data ?? []) as AdmissionCycle[];
    return list.filter((c) => c.status !== 'DRAFT' || list.length === 1);
  }, [cyclesQuery.data]);

  const academicYearName = useMemo(() => {
    if (yearMode === 'create') return newYearName.trim();
    const y = (yearsQuery.data ?? []).find((row) => row.id === academicYearId);
    return y?.name ?? '';
  }, [yearMode, newYearName, yearsQuery.data, academicYearId]);

  const previewQuery = useQuery({
    queryKey: ['admission-cycle-clone-preview', sourceCycleId, academicYearName],
    queryFn: () =>
      previewCycleClone({
        sourceCycleId,
        academicYearName,
      }),
    enabled: open && Boolean(sourceCycleId) && Boolean(academicYearName) && step >= 2,
  });

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setError('');
    setDoneCycleId(null);
    setDoneMessage('');
    setPublishNow(false);
    setArchiveSource(true);
    setPrefixOverride('');
    setRegistrationOpensAt('');
    setRegistrationClosesAt('');
    setApplicationDeadline('');
    setPaymentDeadline('');
  }, [open]);

  useEffect(() => {
    if (!open || sourceCycleId || !sourceCycles.length) return;
    const preferred =
      sourceCycles.find((c) => c.status === 'OPEN') ??
      sourceCycles.find((c) => c.status === 'CLOSED') ??
      sourceCycles[0];
    if (preferred) setSourceCycleId(preferred.id);
  }, [open, sourceCycles, sourceCycleId]);

  useEffect(() => {
    if (!open || !sourceCycleId) return;
    const source = (cyclesQuery.data ?? []).find((c) => c.id === sourceCycleId);
    if (!source) return;
    const settings = (source.settings ?? {}) as {
      applicationFee?: number;
      admissionFeeMin?: number;
      helpDesk?: { phone?: string; email?: string };
    };
    setApplicationFee(String(settings.applicationFee ?? 600));
    setAdmissionFeeMin(String(settings.admissionFeeMin ?? 10500));
    setHelpPhone(settings.helpDesk?.phone ?? '');
    setHelpEmail(settings.helpDesk?.email ?? '');
  }, [open, sourceCycleId, cyclesQuery.data]);

  useEffect(() => {
    if (!previewQuery.data?.proposedPrefix) return;
    setPrefixOverride(previewQuery.data.proposedPrefix);
  }, [sourceCycleId, academicYearName, previewQuery.data?.proposedPrefix]);

  const cloneMutation = useMutation({
    mutationFn: async () => {
      if (!sourceCycleId) throw new Error('Select a source cycle');
      if (!academicYearName) throw new Error('Academic year is required');

      const payload = {
        sourceCycleId,
        applicationNumberPrefix: prefixOverride || undefined,
        deadlineMode: 'clear' as const,
        archiveSource: false,
        registrationOpensAt: toIsoLocal(registrationOpensAt),
        registrationClosesAt: toIsoLocal(registrationClosesAt),
        applicationDeadline: toIsoLocal(applicationDeadline),
        paymentDeadline: toIsoLocal(paymentDeadline),
        settingsOverrides: {
          applicationFee: Number(applicationFee) || 600,
          admissionFeeMin: Number(admissionFeeMin) || 10500,
          helpDesk: {
            phone: helpPhone.trim() || undefined,
            email: helpEmail.trim() || undefined,
          },
          applicationNumberPrefix: prefixOverride || undefined,
        },
        ...(yearMode === 'existing'
          ? { academicYearId }
          : {
              createAcademicYear: {
                name: newYearName.trim(),
                startDate: newYearStart,
                endDate: newYearEnd,
              },
            }),
      };

      const result = await cloneAdmissionCycle(payload);
      const newId = result.cycle.id;

      if (archiveSource && sourceCycleId) {
        await archiveAdmissionCycle(sourceCycleId);
      }

      if (publishNow) {
        await publishCycle(newId);
        if (!archiveSource && sourceCycleId) {
          // Publish closes other OPEN cycles; still soft-archive source for read-only history
          try {
            await archiveAdmissionCycle(sourceCycleId);
          } catch {
            /* source may already be CLOSED — archive still preferred */
          }
        }
      }

      return { result, published: publishNow };
    },
    onSuccess: async ({ result, published }) => {
      setDoneCycleId(result.cycle.id);
      setDoneMessage(
        published
          ? `Created and published ${result.summary.applicationNumberPrefix} (seq resets to 0001).`
          : `Draft cycle created with prefix ${result.summary.applicationNumberPrefix}. Review dates then publish when ready.`,
      );
      await qc.invalidateQueries({ queryKey: ['admission-cycles'] });
      await qc.invalidateQueries({ queryKey: ['academic-years'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const canNext = (() => {
    if (step === 0) return Boolean(sourceCycleId);
    if (step === 1) {
      if (yearMode === 'existing') return Boolean(academicYearId);
      return Boolean(newYearName.trim() && newYearStart && newYearEnd);
    }
    if (step === 2) return Boolean(previewQuery.data) && !previewQuery.isError;
    if (step === 3) {
      return Boolean(
        registrationOpensAt &&
        registrationClosesAt &&
        applicationDeadline &&
        Number(applicationFee) >= 0,
      );
    }
    return true;
  })();

  const preview = previewQuery.data;

  function onYearNameBlur() {
    if (yearMode !== 'create' || !newYearName.trim()) return;
    if (newYearStart && newYearEnd) return;
    const bounds = defaultYearBounds(newYearName);
    if (!newYearStart) setNewYearStart(bounds.startDate);
    if (!newYearEnd) setNewYearEnd(bounds.endDate);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Admission Cycle</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Clone programmes, intakes, and seat matrix from a prior cycle. Applications and history
            are never copied or deleted.
          </p>
        </DialogHeader>

        {doneCycleId ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-foreground">{doneMessage}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Form schema &amp; document slots are reused automatically (tenant-global).</li>
              <li>
                Notification templates stay in{' '}
                <Link href="/admin/communication/templates" className="underline">
                  Communications
                </Link>
                .
              </li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={`/admin/admissions/cycles/${doneCycleId}`}>Configure cycle</Link>
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {STEPS.map((label, i) => (
                <div
                  key={label}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs',
                    i < step
                      ? 'bg-emerald-600 text-white'
                      : i === step
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {i < step ? <Check className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}
                  {label}
                </div>
              ))}
            </div>

            {error ? (
              <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            {step === 0 ? (
              <div className="space-y-3">
                <Label htmlFor="source-cycle">Source cycle</Label>
                <select
                  id="source-cycle"
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                  value={sourceCycleId}
                  onChange={(e) => setSourceCycleId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {sourceCycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.status}) — {c.academicYear?.name ?? '—'}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Defaults to the latest OPEN or CLOSED cycle. History on that cycle stays intact.
                </p>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={yearMode === 'create' ? 'default' : 'outline'}
                    onClick={() => setYearMode('create')}
                  >
                    Create academic year
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={yearMode === 'existing' ? 'default' : 'outline'}
                    onClick={() => setYearMode('existing')}
                  >
                    Use existing year
                  </Button>
                </div>

                {yearMode === 'create' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="ay-name">Academic year name</Label>
                      <Input
                        id="ay-name"
                        placeholder="2027-2028"
                        value={newYearName}
                        onChange={(e) => setNewYearName(e.target.value)}
                        onBlur={onYearNameBlur}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ay-start">Start date</Label>
                      <Input
                        id="ay-start"
                        type="date"
                        value={newYearStart}
                        onChange={(e) => setNewYearStart(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ay-end">End date</Label>
                      <Input
                        id="ay-end"
                        type="date"
                        value={newYearEnd}
                        onChange={(e) => setNewYearEnd(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="ay-existing">Academic year</Label>
                    <select
                      id="ay-existing"
                      className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                      value={academicYearId}
                      onChange={(e) => setAcademicYearId(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {(yearsQuery.data ?? []).map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Clone is refused if that year already has an admission cycle.
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-3 text-sm">
                {previewQuery.isLoading ? (
                  <p className="text-muted-foreground">Loading preview…</p>
                ) : previewQuery.isError ? (
                  <p className="text-destructive">{apiErrorMessage(previewQuery.error)}</p>
                ) : preview ? (
                  <>
                    <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
                      <p>
                        <span className="text-muted-foreground">Prefix:</span>{' '}
                        <strong>{preview.proposedPrefix}</strong>
                      </p>
                      <p>
                        <span className="text-muted-foreground">First app #:</span>{' '}
                        <strong>{preview.proposedPrefix}-0001</strong>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Programmes:</span>{' '}
                        {preview.programCount}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Intakes:</span>{' '}
                        {preview.intakeCount}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Total seats:</span>{' '}
                        {preview.totalSeats}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Code:</span> {preview.proposedCode}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prefix">Application number prefix</Label>
                      <Input
                        id="prefix"
                        value={prefixOverride}
                        onChange={(e) => setPrefixOverride(e.target.value.toUpperCase())}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{preview.formDocsTemplatesNote}</p>
                    {preview.warnings.map((w) => (
                      <p key={w} className="text-xs text-amber-700 dark:text-amber-400">
                        {w}
                      </p>
                    ))}
                  </>
                ) : null}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-open">Registration opens</Label>
                  <Input
                    id="reg-open"
                    type="datetime-local"
                    value={registrationOpensAt}
                    onChange={(e) => setRegistrationOpensAt(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-close">Registration closes</Label>
                  <Input
                    id="reg-close"
                    type="datetime-local"
                    value={registrationClosesAt}
                    onChange={(e) => setRegistrationClosesAt(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="app-deadline">Application deadline</Label>
                  <Input
                    id="app-deadline"
                    type="datetime-local"
                    value={applicationDeadline}
                    onChange={(e) => setApplicationDeadline(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-deadline">Payment deadline</Label>
                  <Input
                    id="pay-deadline"
                    type="datetime-local"
                    value={paymentDeadline}
                    onChange={(e) => setPaymentDeadline(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="app-fee">Application fee (₹)</Label>
                  <Input
                    id="app-fee"
                    type="number"
                    min={0}
                    value={applicationFee}
                    onChange={(e) => setApplicationFee(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adm-fee">Admission fee min (₹)</Label>
                  <Input
                    id="adm-fee"
                    type="number"
                    min={0}
                    value={admissionFeeMin}
                    onChange={(e) => setAdmissionFeeMin(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="help-phone">Help desk phone</Label>
                  <Input
                    id="help-phone"
                    value={helpPhone}
                    onChange={(e) => setHelpPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="help-email">Help desk email</Label>
                  <Input
                    id="help-email"
                    type="email"
                    value={helpEmail}
                    onChange={(e) => setHelpEmail(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-3 text-sm">
                <p>
                  Create a <strong>DRAFT</strong> cycle for <strong>{academicYearName}</strong> from
                  the selected source. Seat matrix and settings copy; applications do not.
                </p>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={archiveSource}
                    onChange={(e) => setArchiveSource(e.target.checked)}
                  />
                  <span>
                    Soft-archive the source cycle as read-only after clone (recommended). History
                    remains searchable.
                  </span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={publishNow}
                    onChange={(e) => setPublishNow(e.target.checked)}
                  />
                  <span>
                    Publish portal now (opens this cycle and closes any other OPEN cycle).
                  </span>
                </label>
                <p className="text-xs text-muted-foreground">
                  Prefix {prefixOverride || preview?.proposedPrefix || '—'}; first number{' '}
                  {(prefixOverride || preview?.proposedPrefix || 'DBCT') + '-0001'}.
                </p>
              </div>
            ) : null}

            <DialogFooter className="mt-4 gap-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                disabled={step === 0 || cloneMutation.isPending}
                onClick={() => {
                  setError('');
                  setStep((s) => Math.max(0, s - 1));
                }}
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={cloneMutation.isPending}
                >
                  Cancel
                </Button>
                {step < STEPS.length - 1 ? (
                  <Button
                    type="button"
                    disabled={!canNext}
                    onClick={() => {
                      setError('');
                      setStep((s) => Math.min(STEPS.length - 1, s + 1));
                    }}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={!canNext || cloneMutation.isPending}
                    onClick={() => {
                      setError('');
                      cloneMutation.mutate();
                    }}
                  >
                    {cloneMutation.isPending
                      ? 'Creating…'
                      : publishNow
                        ? 'Create & publish'
                        : 'Create draft cycle'}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
