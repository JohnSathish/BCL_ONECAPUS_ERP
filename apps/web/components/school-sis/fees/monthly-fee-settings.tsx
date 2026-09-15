'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  fetchMonthlyFeeConfig,
  saveMonthlyFeePlan,
  saveMonthlyFeeSettings,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { MonthlyFeeSubnav, rs } from './monthly-fee-ui';

const METHODS = ['CASH', 'UPI', 'BANK', 'CHEQUE', 'OTHER'];

export function MonthlyFeeSettings() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['monthly-fee-config'],
    queryFn: fetchMonthlyFeeConfig,
    enabled,
  });
  const [error, setError] = useState<string | null>(null);
  const [dueDay, setDueDay] = useState('15');
  const [late, setLate] = useState('20');
  const [lateEnabled, setLateEnabled] = useState(true);
  const [signatory, setSignatory] = useState('');
  const [prefix, setPrefix] = useState('FB');
  const [schoolName, setSchoolName] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [methods, setMethods] = useState<string[]>(METHODS);

  useEffect(() => {
    const s = query.data?.settings;
    if (!s) return;
    setDueDay(String(s.dueDay));
    setLate(String(s.lateFeeAmount));
    setLateEnabled(s.lateFeeEnabled);
    setSignatory(s.signatoryName ?? '');
    setPrefix(s.receiptPrefix);
    setSchoolName(s.schoolName);
    setSchoolAddress(s.schoolAddress);
    setLogoUrl(s.logoUrl ?? '');
    setInstructions((s.instructionsJson ?? []).join('\n'));
    setMethods(s.paymentMethods?.length ? s.paymentMethods : METHODS);
  }, [query.data?.settings]);

  return (
    <div className="space-y-5">
      <MonthlyFeeSubnav />
      <h1 className="text-2xl font-semibold">Fee configuration</h1>
      <p className="text-sm text-slate-500">
        Academic year {query.data?.academicYear.name}. Nursery–IV uses the junior fee book (tuition
        only, due by the 15th). Classes V–X use the printed monthly book: tuition ₹600, computer
        ₹100, late ₹20, due by the 10th. Changing amounts does not alter receipts already issued.
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {query.isLoading ? <p className="text-sm text-slate-500">Loading configuration…</p> : null}
      {query.data?.settings ? (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void saveMonthlyFeeSettings({
              dueDay: Number(dueDay),
              lateFeeAmount: Number(late),
              lateFeeEnabled: lateEnabled,
              receiptPrefix: prefix,
              signatoryName: signatory,
              schoolName,
              schoolAddress,
              logoUrl: logoUrl || null,
              paymentMethods: methods,
              instructions: instructions
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean),
            })
              .then(() => {
                setError(null);
                void qc.invalidateQueries({ queryKey: ['monthly-fee-config'] });
              })
              .catch((err) => setError(apiErrorMessage(err)));
          }}
        >
          <section
            className={`rounded-3xl p-5 ring-1 ${
              lateEnabled ? 'bg-white ring-slate-100' : 'bg-amber-50 ring-amber-100'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Late fee collection</h2>
                <p className="mt-1 max-w-xl text-sm text-slate-500">
                  Turn this off if management decides not to collect late fees. Overdue months will
                  then show only tuition (and computer fee for V–X). Receipts already issued are not
                  changed.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold ring-1 ring-slate-200">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={lateEnabled}
                  onChange={(e) => setLateEnabled(e.target.checked)}
                  disabled={!canManage}
                />
                {lateEnabled ? 'Collect late fees' : 'Late fees off'}
              </label>
            </div>
            <label className="mt-4 block max-w-xs text-sm">
              Late fee amount (₹)
              <input
                className="mt-1 h-10 w-full rounded-xl border px-3 disabled:bg-slate-50"
                value={late}
                onChange={(e) => setLate(e.target.value)}
                disabled={!canManage || !lateEnabled}
              />
              <span className="mt-1 block text-xs text-slate-500">
                Charged after the due date (15th for Nursery–IV, 10th for Classes V–X) when late
                fees are on.
              </span>
            </label>
          </section>

          <div className="grid gap-3 rounded-3xl bg-white p-5 ring-1 ring-slate-100 sm:grid-cols-2">
            <label className="text-sm">
              Due day of month (Nursery–IV)
              <input
                className="mt-1 h-10 w-full rounded-xl border px-3"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                disabled={!canManage}
              />
              <span className="mt-1 block text-xs text-slate-500">
                Junior fee book: 15th. Classes V–X always use the 10th from the Class V–X fee book.
              </span>
            </label>
            <label className="text-sm">
              Receipt prefix
              <input
                className="mt-1 h-10 w-full rounded-xl border px-3"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                disabled={!canManage}
              />
            </label>
            <label className="text-sm">
              Authorized signatory
              <input
                className="mt-1 h-10 w-full rounded-xl border px-3"
                value={signatory}
                onChange={(e) => setSignatory(e.target.value)}
                disabled={!canManage}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              School name on receipt
              <input
                className="mt-1 h-10 w-full rounded-xl border px-3"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                disabled={!canManage}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              Address
              <input
                className="mt-1 h-10 w-full rounded-xl border px-3"
                value={schoolAddress}
                onChange={(e) => setSchoolAddress(e.target.value)}
                disabled={!canManage}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              Logo URL
              <input
                className="mt-1 h-10 w-full rounded-xl border px-3"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                disabled={!canManage}
              />
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm">Payment methods</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {METHODS.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={methods.includes(m)}
                      disabled={!canManage}
                      onChange={(e) => {
                        setMethods((cur) =>
                          e.target.checked ? [...cur, m] : cur.filter((x) => x !== m),
                        );
                      }}
                    />
                    {m}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="text-sm sm:col-span-2">
              General instructions (one per line)
              <textarea
                className="mt-1 min-h-28 w-full rounded-xl border px-3 py-2"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                disabled={!canManage}
              />
            </label>
            {canManage ? (
              <button
                type="submit"
                className="h-10 rounded-xl bg-[var(--school-erp-primary)] text-white sm:col-span-2"
              >
                Save rules
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">Monthly tuition</th>
              <th className="px-3 py-2">Computer / other</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(query.data?.plans ?? []).map((plan) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                canManage={canManage}
                onError={setError}
                onSaved={() => qc.invalidateQueries({ queryKey: ['monthly-fee-config'] })}
              />
            ))}
          </tbody>
        </table>
        {query.data && !query.data.plans.length ? (
          <p className="p-6 text-center text-sm text-slate-500">
            No Nursery–X classes found for this academic year.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PlanRow({
  plan,
  canManage,
  onError,
  onSaved,
}: {
  plan: { gradeId: string; tuitionAmount: number; otherAmount: number; grade: { name: string } };
  canManage: boolean;
  onError: (msg: string | null) => void;
  onSaved: () => void;
}) {
  const [tuition, setTuition] = useState(String(plan.tuitionAmount));
  const [other, setOther] = useState(String(plan.otherAmount));
  return (
    <tr className="border-t">
      <td className="px-3 py-2 font-medium">{plan.grade.name}</td>
      <td className="px-3 py-2">
        <input
          className="h-9 w-28 rounded-lg border px-2"
          value={tuition}
          onChange={(e) => setTuition(e.target.value)}
          disabled={!canManage}
        />
      </td>
      <td className="px-3 py-2">
        <input
          className="h-9 w-28 rounded-lg border px-2"
          value={other}
          onChange={(e) => setOther(e.target.value)}
          disabled={!canManage}
        />
      </td>
      <td className="px-3 py-2">
        {canManage ? (
          <button
            type="button"
            className="text-[var(--school-erp-primary)]"
            onClick={() => {
              void saveMonthlyFeePlan({
                gradeId: plan.gradeId,
                tuitionAmount: Number(tuition),
                otherAmount: Number(other) || 0,
              })
                .then(() => {
                  onError(null);
                  onSaved();
                })
                .catch((err) => onError(apiErrorMessage(err)));
            }}
          >
            Save {rs(Number(tuition) || 0)}
          </button>
        ) : null}
      </td>
    </tr>
  );
}
