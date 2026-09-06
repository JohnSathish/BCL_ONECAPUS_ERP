'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchSchoolAdmissionWindow,
  updateSchoolAdmissionWindow,
} from '@/services/school-admissions';
import { apiErrorMessage } from '@/utils/api-error';

/** Convert API ISO → datetime-local value in local browser time. */
function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local → ISO (or null if empty). */
function fromDatetimeLocalValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function SchoolAdmissionWindowSettingsPage() {
  const enabled = useAuthQueryEnabled();
  const queryClient = useQueryClient();
  const windowQ = useQuery({
    queryKey: ['school-admission-window'],
    queryFn: fetchSchoolAdmissionWindow,
    enabled,
  });

  const [enabledToggle, setEnabledToggle] = useState(true);
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [maxApplications, setMaxApplications] = useState('50');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!windowQ.data) return;
    setEnabledToggle(windowQ.data.newAdmissionsEnabled);
    setOpensAt(toDatetimeLocalValue(windowQ.data.registrationOpensAt));
    setClosesAt(toDatetimeLocalValue(windowQ.data.registrationClosesAt));
    setMaxApplications(String(windowQ.data.maxOnlineApplications ?? 50));
  }, [windowQ.data]);

  const save = useMutation({
    mutationFn: () =>
      updateSchoolAdmissionWindow({
        newAdmissionsEnabled: enabledToggle,
        registrationOpensAt: fromDatetimeLocalValue(opensAt),
        registrationClosesAt: fromDatetimeLocalValue(closesAt),
        maxOnlineApplications: Number(maxApplications),
      }),
    onSuccess: async (data) => {
      setError(null);
      setMessage(
        data.isOpen
          ? 'Admission settings saved. New online admissions are OPEN.'
          : 'Admission settings saved. New online admissions are CLOSED.',
      );
      await queryClient.invalidateQueries({ queryKey: ['school-admission-window'] });
      await queryClient.invalidateQueries({ queryKey: ['school-office-summary'] });
      await queryClient.invalidateQueries({ queryKey: ['school-admissions-info'] });
    },
    onError: (err) => {
      setMessage(null);
      setError(apiErrorMessage(err));
    },
  });

  const status = windowQ.data;
  const open = status?.isOpen;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--school-erp-muted)]">
          Admission 2027
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--school-erp-primary)]">
          Admission Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--school-erp-muted)]">
          Control the K.G. online application period without redeploying. Existing submitted
          applications are not changed.
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <Link
            href="/admin/school-admissions"
            className="font-medium text-[var(--school-erp-primary)] underline"
          >
            ← Applications
          </Link>
          <Link
            href="/admin/school-admissions/settings"
            className="font-medium text-[var(--school-erp-primary)] underline"
          >
            Certificate settings
          </Link>
        </div>
      </div>

      <div
        className={`rounded-2xl border px-4 py-3 text-sm ${
          open
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-rose-200 bg-rose-50 text-rose-900'
        }`}
      >
        <p className="font-semibold">{open ? '🟢 Admissions Open' : '🔴 Admissions Closed'}</p>
        <p className="mt-1">{status?.message ?? 'Loading current status…'}</p>
        {status?.lastDateLabel ? (
          <p className="mt-1">Closing Date: {status.lastDateLabel}</p>
        ) : null}
        {typeof status?.maxOnlineApplications === 'number' ? (
          <p className="mt-1">
            Applications: {status.applicationCount ?? 0} of {status.maxOnlineApplications}
            {typeof status.seatsRemaining === 'number'
              ? ` (${status.seatsRemaining} remaining)`
              : ''}
          </p>
        ) : null}
      </div>

      <form
        className="space-y-5 rounded-2xl border bg-white p-5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
          <div>
            <p className="font-medium">New Admission</p>
            <p className="text-xs text-muted-foreground">
              OFF disables parent registration immediately, even if dates are still open.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabledToggle}
            className={`relative h-8 w-14 rounded-full transition-colors ${
              enabledToggle ? 'bg-[#1b4d3e]' : 'bg-slate-300'
            }`}
            onClick={() => setEnabledToggle((v) => !v)}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                enabledToggle ? 'left-7' : 'left-1'
              }`}
            />
            <span className="sr-only">{enabledToggle ? 'ON' : 'OFF'}</span>
          </button>
          <span className="w-10 text-sm font-semibold">{enabledToggle ? 'ON' : 'OFF'}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="opensAt">Admission Start Date / Time</Label>
            <Input
              id="opensAt"
              type="datetime-local"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Leave blank if already open.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="closesAt">Admission Last Date / Time</Label>
            <Input
              id="closesAt"
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              After this time, new online applications close automatically. Change anytime to extend
              or reopen.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxApplications">Maximum online applications</Label>
          <Input
            id="maxApplications"
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            step={1}
            value={maxApplications}
            onChange={(e) => setMaxApplications(e.target.value.replace(/\D/g, ''))}
          />
          <p className="text-xs text-muted-foreground">
            Default is 50. Raise this to 100, 150, or any number when the Principal allows more
            applications. New registrations stop automatically when this count is reached. Existing
            applicants can still log in and complete their form.
          </p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-800">{message}</p> : null}

        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            className="bg-[#1b4d3e] text-white hover:bg-[#14382d]"
            disabled={save.isPending || windowQ.isLoading}
          >
            {save.isPending ? 'Saving…' : 'Save admission settings'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!windowQ.data) return;
              setEnabledToggle(windowQ.data.newAdmissionsEnabled);
              setOpensAt(toDatetimeLocalValue(windowQ.data.registrationOpensAt));
              setClosesAt(toDatetimeLocalValue(windowQ.data.registrationClosesAt));
              setMaxApplications(String(windowQ.data.maxOnlineApplications ?? 50));
              setMessage(null);
              setError(null);
            }}
          >
            Reset form
          </Button>
        </div>
      </form>

      <p className="text-xs text-muted-foreground">
        Cycle: {status?.title ?? '—'} ({status?.code ?? '—'}). Changes are stored in the database
        and audited (who / previous / new / time).
      </p>
    </div>
  );
}
