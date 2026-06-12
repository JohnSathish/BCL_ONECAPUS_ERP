'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  SectionCard,
  Field,
  FieldGrid,
  inputClass,
} from '@/components/student-profile/student-profile-shell';
import { Button } from '@/components/ui/button';
import {
  fetchStaffPfConfig,
  fetchStaffPfHistory,
  upsertStaffPfConfig,
  type StaffPfConfigRecord,
} from '@/services/payroll';
import { apiErrorMessage } from '@/utils/api-error';
import type { StaffProfile } from '@/types/staff';

const PF_SCHEMES = [
  { value: 'PF_12_PERCENT', label: 'PF 12%' },
  { value: 'PF_FIXED_AMOUNT', label: 'PF Fixed Amount' },
  { value: 'CPF', label: 'CPF' },
  { value: 'CUSTOM', label: 'Custom' },
  { value: 'NOT_APPLICABLE', label: 'Not Applicable' },
] as const;

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatInr(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function StaffPfSection({ profile, canEdit }: { profile: StaffProfile; canEdit: boolean }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');

  const configQ = useQuery({
    queryKey: ['staff-pf-config', profile.id],
    queryFn: () => fetchStaffPfConfig(profile.id),
  });

  const historyQ = useQuery({
    queryKey: ['staff-pf-history', profile.id],
    queryFn: () => fetchStaffPfHistory(profile.id),
  });

  const config = configQ.data?.config;

  const [form, setForm] = useState<StaffPfConfigRecord | null>(null);

  const effectiveForm = form ?? config ?? null;

  const saveMut = useMutation({
    mutationFn: () => {
      if (!effectiveForm) throw new Error('No configuration loaded');
      return upsertStaffPfConfig(profile.id, {
        pfEnabled: effectiveForm.pfEnabled,
        employeePfApplicable: effectiveForm.employeePfApplicable,
        employerPfApplicable: effectiveForm.employerPfApplicable,
        pfScheme: effectiveForm.pfScheme,
        employeePfAmount: effectiveForm.employeePfAmount,
        employerPfAmount: effectiveForm.employerPfAmount,
        pfAccountNumber: effectiveForm.pfAccountNumber,
        uanNumber: effectiveForm.uanNumber,
        effectiveFrom: new Date(effectiveForm.effectiveFrom).toISOString().slice(0, 10),
        remarks: effectiveForm.remarks,
      });
    },
    onSuccess: () => {
      setMessage('PF configuration saved');
      setForm(null);
      void qc.invalidateQueries({ queryKey: ['staff-pf-config', profile.id] });
      void qc.invalidateQueries({ queryKey: ['staff-pf-history', profile.id] });
      setTimeout(() => setMessage(''), 2500);
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not save PF configuration')),
  });

  const setField = <K extends keyof StaffPfConfigRecord>(key: K, value: StaffPfConfigRecord[K]) => {
    const base = form ?? config;
    if (!base) return;
    const next = { ...base, [key]: value };
    if (key === 'pfEnabled' && value === false) {
      next.pfScheme = 'NOT_APPLICABLE';
      next.employeePfApplicable = false;
      next.employerPfApplicable = false;
    }
    if (key === 'pfEnabled' && value === true && next.pfScheme === 'NOT_APPLICABLE') {
      next.pfScheme = 'PF_12_PERCENT';
      next.employeePfApplicable = true;
      next.employerPfApplicable = true;
    }
    setForm(next);
  };

  if (configQ.isLoading || !effectiveForm) {
    return (
      <SectionCard
        title="PF Configuration"
        description="Provident Fund eligibility and contribution settings"
      >
        <p className="text-xs text-muted-foreground">Loading PF configuration…</p>
      </SectionCard>
    );
  }

  const showAmounts =
    effectiveForm.pfEnabled &&
    (effectiveForm.pfScheme === 'PF_FIXED_AMOUNT' ||
      effectiveForm.pfScheme === 'CUSTOM' ||
      effectiveForm.pfScheme === 'CPF');

  return (
    <div className="space-y-3">
      <SectionCard
        title="PF Configuration"
        description="Individual PF eligibility — enrolled staff receive employer + employee PF; exempt staff have no PF on payroll."
        footer={message || (saveMut.isPending ? 'Saving…' : undefined)}
      >
        <FieldGrid>
          <Field label="PF Enabled">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={effectiveForm.pfEnabled}
                disabled={!canEdit}
                onChange={(e) => setField('pfEnabled', e.target.checked)}
              />
              {effectiveForm.pfEnabled ? 'Enrolled in PF' : 'PF Exempt'}
            </label>
          </Field>
          <Field label="PF Scheme">
            <select
              className={inputClass}
              disabled={!canEdit || !effectiveForm.pfEnabled}
              value={effectiveForm.pfScheme}
              onChange={(e) => setField('pfScheme', e.target.value)}
            >
              {PF_SCHEMES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Employer PF Applicable">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={effectiveForm.employerPfApplicable}
                disabled={!canEdit || !effectiveForm.pfEnabled}
                onChange={(e) => setField('employerPfApplicable', e.target.checked)}
              />
              College contribution
            </label>
          </Field>
          <Field label="Employee PF Applicable">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={effectiveForm.employeePfApplicable}
                disabled={!canEdit || !effectiveForm.pfEnabled}
                onChange={(e) => setField('employeePfApplicable', e.target.checked)}
              />
              Employee deduction
            </label>
          </Field>
          {showAmounts ? (
            <>
              <Field label="Employer PF Amount">
                <input
                  type="number"
                  className={inputClass}
                  disabled={!canEdit}
                  value={effectiveForm.employerPfAmount ?? ''}
                  onChange={(e) =>
                    setField('employerPfAmount', e.target.value ? Number(e.target.value) : null)
                  }
                />
              </Field>
              <Field label="Employee PF Amount">
                <input
                  type="number"
                  className={inputClass}
                  disabled={!canEdit}
                  value={effectiveForm.employeePfAmount ?? ''}
                  onChange={(e) =>
                    setField('employeePfAmount', e.target.value ? Number(e.target.value) : null)
                  }
                />
              </Field>
            </>
          ) : null}
          <Field label="PF Account Number">
            <input
              className={inputClass}
              disabled={!canEdit}
              value={effectiveForm.pfAccountNumber ?? ''}
              onChange={(e) => setField('pfAccountNumber', e.target.value || null)}
            />
          </Field>
          <Field label="UAN Number">
            <input
              className={inputClass}
              disabled={!canEdit}
              value={effectiveForm.uanNumber ?? ''}
              onChange={(e) => setField('uanNumber', e.target.value || null)}
            />
          </Field>
          <Field label="Effective From">
            <input
              type="date"
              className={inputClass}
              disabled={!canEdit}
              value={new Date(effectiveForm.effectiveFrom).toISOString().slice(0, 10)}
              onChange={(e) => setField('effectiveFrom', e.target.value)}
            />
          </Field>
          <Field label="Remarks">
            <input
              className={inputClass}
              disabled={!canEdit}
              value={effectiveForm.remarks ?? ''}
              onChange={(e) => setField('remarks', e.target.value || null)}
            />
          </Field>
        </FieldGrid>

        {effectiveForm.pfEnabled ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Example (PF 12% capped): Basic + Employer PF ₹780 → Gross; PPF deduction ₹1,560
            (employer + employee share).
          </p>
        ) : (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
            PF exempt — no PF lines on payslip; gross equals basic plus other earnings only.
          </p>
        )}

        {canEdit ? (
          <Button
            size="sm"
            className="mt-3"
            disabled={saveMut.isPending || !form}
            onClick={() => saveMut.mutate()}
          >
            Save PF Configuration
          </Button>
        ) : null}
      </SectionCard>

      <SectionCard title="PF History" description="Audit trail — history is never deleted">
        {(historyQ.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No PF configuration changes recorded yet.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {(historyQ.data ?? []).map((h) => (
              <li key={h.id} className="rounded-md border border-border/60 p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{h.action.replace(/_/g, ' ')}</span>
                  <span className="text-muted-foreground">{formatDate(h.createdAt)}</span>
                </div>
                {h.effectiveFrom ? (
                  <p className="text-muted-foreground">
                    Effective from {formatDate(h.effectiveFrom)}
                  </p>
                ) : null}
                <p className="text-muted-foreground">
                  {(h.snapshot as StaffPfConfigRecord)?.pfEnabled ? 'PF Enabled' : 'PF Disabled'} ·{' '}
                  {(h.snapshot as StaffPfConfigRecord)?.pfSchemeLabel ??
                    (h.snapshot as { pfScheme?: string })?.pfScheme}
                  {(h.snapshot as StaffPfConfigRecord)?.employerPfAmount != null
                    ? ` · Employer ${formatInr((h.snapshot as StaffPfConfigRecord).employerPfAmount)}`
                    : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
