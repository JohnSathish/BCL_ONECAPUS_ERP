'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchSchoolAttendanceSettings, saveSchoolAttendanceSettings } from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { AttendanceShell } from './attendance-ui';
import { PrimaryButton } from '../academic/academic-ui';

export function AttendanceSettingsDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['school-att-settings'],
    queryFn: () => fetchSchoolAttendanceSettings(),
    enabled,
  });
  const s = q.data?.settings ?? {};
  const [form, setForm] = useState<Record<string, unknown> | null>(null);
  const f = form ?? s;
  const save = useMutation({
    mutationFn: () => saveSchoolAttendanceSettings(f),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['school-att-settings'] }),
    onError: (e) => setError(apiErrorMessage(e)),
  });
  function set<K extends string>(key: K, value: unknown) {
    setForm({ ...f, [key]: value });
  }
  return (
    <AttendanceShell
      title="Attendance settings"
      subtitle="School rules — not hard-coded. Different campuses can use daily, period, or both."
    >
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-3">
        <label className="text-sm">
          Mode
          <select
            className="mt-1 h-10 w-full rounded-lg border px-3"
            value={String(f.mode ?? 'DAILY')}
            onChange={(e) => set('mode', e.target.value)}
          >
            <option value="DAILY">Daily only</option>
            <option value="PERIOD">Period only</option>
            <option value="BOTH">Daily and period</option>
          </select>
        </label>
        <label className="text-sm">
          Default status
          <select
            className="mt-1 h-10 w-full rounded-lg border px-3"
            value={String(f.defaultStatus ?? 'PRESENT')}
            onChange={(e) => set('defaultStatus', e.target.value)}
          >
            <option>PRESENT</option>
            <option>ABSENT</option>
          </select>
        </label>
        <label className="text-sm">
          Default marking
          <select
            className="mt-1 h-10 w-full rounded-lg border px-3"
            value={String(f.defaultMarking ?? 'ALL_PRESENT')}
            onChange={(e) => set('defaultMarking', e.target.value)}
          >
            <option value="ALL_PRESENT">All present</option>
            <option value="BLANK">Blank</option>
          </select>
        </label>
        <label className="text-sm">
          Lock after (hours)
          <input
            type="number"
            className="mt-1 h-10 w-full rounded-lg border px-3"
            value={Number(f.lockAfterHours ?? 24)}
            onChange={(e) => set('lockAfterHours', Number(e.target.value))}
          />
        </label>
        <label className="text-sm">
          Minimum attendance %
          <input
            type="number"
            className="mt-1 h-10 w-full rounded-lg border px-3"
            value={Number(f.minPercent ?? 75)}
            onChange={(e) => set('minPercent', Number(e.target.value))}
          />
        </label>
        <label className="text-sm">
          Warning band %
          <input
            type="number"
            className="mt-1 h-10 w-full rounded-lg border px-3"
            value={Number(f.warnPercent ?? 85)}
            onChange={(e) => set('warnPercent', Number(e.target.value))}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(f.lateCountsPresent ?? true)}
            onChange={(e) => set('lateCountsPresent', e.target.checked)}
          />
          Late counts as present
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(f.leaveCountsPresent)}
            onChange={(e) => set('leaveCountsPresent', e.target.checked)}
          />
          Approved leave counts toward %
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(f.excusedCountsPresent ?? true)}
            onChange={(e) => set('excusedCountsPresent', e.target.checked)}
          />
          Excused counts toward %
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(f.absentNotify ?? true)}
            onChange={(e) => set('absentNotify', e.target.checked)}
          />
          Notify parent on absent
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(f.lateNotify)}
            onChange={(e) => set('lateNotify', e.target.checked)}
          />
          Notify parent on late
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(f.correctionRequired ?? true)}
            onChange={(e) => set('correctionRequired', e.target.checked)}
          />
          Correction approval required after submit
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(f.lockEnabled ?? true)}
            onChange={(e) => set('lockEnabled', e.target.checked)}
          />
          Enable locking
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(f.qrEnabled)}
            onChange={(e) => set('qrEnabled', e.target.checked)}
          />
          Enable QR (optional)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(f.geoEnabled)}
            onChange={(e) => set('geoEnabled', e.target.checked)}
          />
          Location validation (optional)
        </label>
        <label className="text-sm">
          Consecutive absence alert
          <input
            type="number"
            className="mt-1 h-10 w-full rounded-lg border px-3"
            value={Number(f.consecutiveAbsentAlert ?? 3)}
            onChange={(e) => set('consecutiveAbsentAlert', Number(e.target.value))}
          />
        </label>
        <label className="text-sm">
          Half-day value
          <input
            type="number"
            step="0.1"
            className="mt-1 h-10 w-full rounded-lg border px-3"
            value={Number(f.halfDayValue ?? 0.5)}
            onChange={(e) => set('halfDayValue', Number(e.target.value))}
          />
        </label>
      </div>
      <PrimaryButton type="button" onClick={() => save.mutate()} disabled={save.isPending}>
        Save settings
      </PrimaryButton>
      <div className="rounded-2xl border bg-white p-4">
        <h2 className="text-sm font-semibold">Status types</h2>
        <ul className="mt-2 text-sm text-slate-600">
          {(q.data?.statuses ?? []).map(
            (st: { code: string; name: string; attendanceValue: number }) => (
              <li key={st.code}>
                {st.code} — {st.name} (value {Number(st.attendanceValue)})
              </li>
            ),
          )}
        </ul>
      </div>
    </AttendanceShell>
  );
}
