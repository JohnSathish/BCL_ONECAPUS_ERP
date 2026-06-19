'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchLibrarySettings,
  fetchLibraryZoneOccupancy,
  updateLibrarySettings,
} from '@/services/library';
import type {
  CirculationPolicy,
  CategoryRulePolicy,
  FinePolicy,
  LibrarySettings,
  MemberRolePolicy,
} from '@/types/library';
import { apiErrorMessage } from '@/utils/api-error';

const DEFAULT_CIRCULATION: CirculationPolicy = {
  student: { loanDays: 14, maxBooks: 3, maxRenewals: 1 },
  faculty: { loanDays: 30, maxBooks: 10, maxRenewals: 2 },
  researchScholar: { loanDays: 45, maxBooks: 15, maxRenewals: 2 },
  staff: { loanDays: 21, maxBooks: 5, maxRenewals: 1 },
  reference: { loanDays: 0, maxBooks: 0, allowIssue: false },
  rare: { loanDays: 7, maxBooks: 1, allowIssue: true, requireApproval: true },
};

const DEFAULT_FINE: FinePolicy = {
  lostBookPenaltyMultiplier: 2,
  damageChargeDefault: 100,
};

function safeNum(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function decimalInput(value: string | undefined | null): string {
  if (value == null) return '';
  const s = String(value);
  return s === 'NaN' ? '' : s;
}

function mergePolicy(raw?: CirculationPolicy): CirculationPolicy {
  if (!raw) return DEFAULT_CIRCULATION;
  const role = (
    key: keyof typeof DEFAULT_CIRCULATION,
    base: MemberRolePolicy | CategoryRulePolicy,
  ) => {
    const patch = raw[key];
    if (!patch || typeof patch !== 'object') return base;
    const merged = { ...base, ...patch };
    if ('loanDays' in merged) {
      return {
        ...merged,
        loanDays: safeNum(merged.loanDays, (base as MemberRolePolicy).loanDays),
        maxBooks: safeNum(merged.maxBooks, (base as MemberRolePolicy).maxBooks),
        ...('maxRenewals' in merged
          ? { maxRenewals: safeNum(merged.maxRenewals, (base as MemberRolePolicy).maxRenewals) }
          : {}),
      };
    }
    return merged;
  };
  return {
    student: role('student', DEFAULT_CIRCULATION.student) as MemberRolePolicy,
    faculty: role('faculty', DEFAULT_CIRCULATION.faculty) as MemberRolePolicy,
    researchScholar: role(
      'researchScholar',
      DEFAULT_CIRCULATION.researchScholar,
    ) as MemberRolePolicy,
    staff: role('staff', DEFAULT_CIRCULATION.staff) as MemberRolePolicy,
    reference: role('reference', DEFAULT_CIRCULATION.reference) as CategoryRulePolicy,
    rare: role('rare', DEFAULT_CIRCULATION.rare) as CategoryRulePolicy,
  };
}

function RoleRow({
  label,
  loanDays,
  maxBooks,
  maxRenewals,
  onChange,
}: {
  label: string;
  loanDays: number;
  maxBooks: number;
  maxRenewals: number;
  onChange: (patch: { loanDays?: number; maxBooks?: number; maxRenewals?: number }) => void;
}) {
  return (
    <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-4 sm:items-end">
      <p className="text-sm font-medium sm:col-span-1">{label}</p>
      <label className="text-xs">
        Loan days
        <Input
          type="number"
          className="mt-1"
          value={safeNum(loanDays)}
          onChange={(e) => onChange({ loanDays: safeNum(e.target.value, loanDays) })}
        />
      </label>
      <label className="text-xs">
        Max books
        <Input
          type="number"
          className="mt-1"
          value={safeNum(maxBooks)}
          onChange={(e) => onChange({ maxBooks: safeNum(e.target.value, maxBooks) })}
        />
      </label>
      <label className="text-xs">
        Max renewals
        <Input
          type="number"
          className="mt-1"
          value={safeNum(maxRenewals)}
          onChange={(e) => onChange({ maxRenewals: safeNum(e.target.value, maxRenewals) })}
        />
      </label>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="h-32 rounded-xl bg-muted" />
      <div className="h-32 rounded-xl bg-muted" />
      <div className="h-24 rounded-xl bg-muted" />
    </div>
  );
}

export function LibrarySettingsPanel() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<Partial<LibrarySettings>>({});
  const [circulation, setCirculation] = useState<CirculationPolicy>(DEFAULT_CIRCULATION);
  const [finePolicy, setFinePolicy] = useState<FinePolicy>(DEFAULT_FINE);

  const settings = useQuery({
    queryKey: ['library', 'settings'],
    queryFn: fetchLibrarySettings,
    enabled,
  });

  const zoneOccupancy = useQuery({
    queryKey: ['library', 'zones', 'occupancy'],
    queryFn: fetchLibraryZoneOccupancy,
    enabled,
  });

  useEffect(() => {
    if (!settings.data) return;
    const s = settings.data;
    setForm({
      totalSeats: safeNum(s.totalSeats),
      finePerDay: decimalInput(s.finePerDay) || '0',
      graceDays: safeNum(s.graceDays),
      maxFine: decimalInput(s.maxFine) || '0',
      defaultLoanDays: safeNum(s.defaultLoanDays, 14),
      qrEntryEnabled: s.qrEntryEnabled ?? true,
      selfCheckInEnabled: s.selfCheckInEnabled ?? true,
      zonesEnabled: s.zonesEnabled ?? true,
      blockIssueOnUnpaidFines: s.blockIssueOnUnpaidFines ?? true,
      overdueNotifyEnabled: s.overdueNotifyEnabled ?? true,
      dueTomorrowNotifyEnabled: s.dueTomorrowNotifyEnabled ?? true,
      assistantEnabled: s.assistantEnabled ?? true,
      rfidEntryEnabled: s.rfidEntryEnabled ?? true,
      maxRenewals: safeNum(s.maxRenewals, 1),
    });
    setCirculation(mergePolicy(s.circulationPolicy));
    setFinePolicy({
      lostBookPenaltyMultiplier: safeNum(
        s.finePolicy?.lostBookPenaltyMultiplier,
        DEFAULT_FINE.lostBookPenaltyMultiplier,
      ),
      damageChargeDefault: safeNum(
        s.finePolicy?.damageChargeDefault,
        DEFAULT_FINE.damageChargeDefault,
      ),
    });
  }, [settings.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateLibrarySettings({
        ...form,
        circulationPolicy: circulation,
        finePolicy,
      }),
    onSuccess: () => {
      setMessage('Settings saved');
      void qc.invalidateQueries({ queryKey: ['library', 'settings'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const patchRole = (
    role: keyof Pick<CirculationPolicy, 'student' | 'faculty' | 'researchScholar' | 'staff'>,
    patch: Partial<MemberRolePolicy>,
  ) => {
    setCirculation((prev) => ({
      ...prev,
      [role]: { ...prev[role], ...patch },
    }));
  };

  if (settings.isLoading || !settings.data) return <SettingsSkeleton />;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5" />
        <h1 className="text-lg font-semibold">Library Settings</h1>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Circulation rules (by member type)</h2>
        <RoleRow
          label="Student"
          loanDays={circulation.student.loanDays}
          maxBooks={circulation.student.maxBooks}
          maxRenewals={circulation.student.maxRenewals}
          onChange={(p) => patchRole('student', p)}
        />
        <RoleRow
          label="Faculty"
          loanDays={circulation.faculty.loanDays}
          maxBooks={circulation.faculty.maxBooks}
          maxRenewals={circulation.faculty.maxRenewals}
          onChange={(p) => patchRole('faculty', p)}
        />
        <RoleRow
          label="Research scholar"
          loanDays={circulation.researchScholar.loanDays}
          maxBooks={circulation.researchScholar.maxBooks}
          maxRenewals={circulation.researchScholar.maxRenewals}
          onChange={(p) => patchRole('researchScholar', p)}
        />
        <RoleRow
          label="Staff"
          loanDays={circulation.staff.loanDays}
          maxBooks={circulation.staff.maxBooks}
          maxRenewals={circulation.staff.maxRenewals}
          onChange={(p) => patchRole('staff', p)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Category rules</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="mb-2 text-sm font-medium">Reference (no issue)</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!circulation.reference.allowIssue}
                onChange={(e) =>
                  setCirculation((prev) => ({
                    ...prev,
                    reference: { ...prev.reference, allowIssue: !e.target.checked },
                  }))
                }
              />
              Block issue for reference books
            </label>
          </div>
          <div className="rounded-lg border p-4">
            <p className="mb-2 text-sm font-medium">Rare collections</p>
            <label className="text-xs">
              Loan days
              <Input
                type="number"
                className="mt-1"
                value={safeNum(circulation.rare.loanDays)}
                onChange={(e) =>
                  setCirculation((prev) => ({
                    ...prev,
                    rare: {
                      ...prev.rare,
                      loanDays: safeNum(e.target.value, prev.rare.loanDays),
                    },
                  }))
                }
              />
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={circulation.rare.requireApproval ?? false}
                onChange={(e) =>
                  setCirculation((prev) => ({
                    ...prev,
                    rare: { ...prev.rare, requireApproval: e.target.checked },
                  }))
                }
              />
              Require approval
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Fine configuration</h2>
        <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Fine per day (₹)
            <Input
              type="number"
              className="mt-1"
              value={decimalInput(form.finePerDay)}
              onChange={(e) => setForm({ ...form, finePerDay: e.target.value })}
            />
          </label>
          <label className="text-sm">
            Grace days
            <Input
              type="number"
              className="mt-1"
              value={safeNum(form.graceDays)}
              onChange={(e) =>
                setForm({ ...form, graceDays: safeNum(e.target.value, form.graceDays ?? 0) })
              }
            />
          </label>
          <label className="text-sm">
            Max fine (₹)
            <Input
              type="number"
              className="mt-1"
              value={decimalInput(form.maxFine)}
              onChange={(e) => setForm({ ...form, maxFine: e.target.value })}
            />
          </label>
          <label className="text-sm">
            Lost book penalty (× price)
            <Input
              type="number"
              step="0.1"
              className="mt-1"
              value={safeNum(finePolicy.lostBookPenaltyMultiplier)}
              onChange={(e) =>
                setFinePolicy((p) => ({
                  ...p,
                  lostBookPenaltyMultiplier: safeNum(e.target.value, p.lostBookPenaltyMultiplier),
                }))
              }
            />
          </label>
          <label className="text-sm">
            Default damage charge (₹)
            <Input
              type="number"
              className="mt-1"
              value={safeNum(finePolicy.damageChargeDefault)}
              onChange={(e) =>
                setFinePolicy((p) => ({
                  ...p,
                  damageChargeDefault: safeNum(e.target.value, p.damageChargeDefault),
                }))
              }
            />
          </label>
          <label className="text-sm">
            Total seats
            <Input
              type="number"
              className="mt-1"
              value={safeNum(form.totalSeats)}
              onChange={(e) =>
                setForm({ ...form, totalSeats: safeNum(e.target.value, form.totalSeats ?? 0) })
              }
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Operational toggles</h2>
        <div className="grid max-w-xl gap-2 text-sm">
          {(
            [
              ['qrEntryEnabled', 'QR entry enabled'],
              ['selfCheckInEnabled', 'Self check-in (student portal)'],
              ['zonesEnabled', 'Smart seat zones'],
              ['blockIssueOnUnpaidFines', 'Block issue when unpaid fines exist'],
              ['overdueNotifyEnabled', 'Daily overdue email reminders'],
              ['dueTomorrowNotifyEnabled', 'Due-tomorrow email reminders'],
              ['assistantEnabled', 'Library Knowledge Assistant'],
              ['rfidEntryEnabled', 'RFID / barcode entry at gate'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(form[key])}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      {zoneOccupancy.data?.length ? (
        <section>
          <h2 className="mb-2 text-sm font-medium">Reading zones</h2>
          <ul className="space-y-1 text-sm">
            {zoneOccupancy.data.map((z) => (
              <li key={z.id} className="flex justify-between rounded border px-3 py-2">
                <span>{z.name}</span>
                <span>
                  {z.occupied ?? 0}/{z.totalSeats} ({z.occupancyPercent ?? 0}%)
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Button disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
        Save settings
      </Button>
    </div>
  );
}
