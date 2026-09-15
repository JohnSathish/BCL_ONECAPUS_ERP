'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileText,
  HelpCircle,
  Info,
  Lightbulb,
  Mail,
  RotateCcw,
  Save,
  Settings2,
  Upload,
  X,
} from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  fetchMonthlyFeeConfig,
  resetMonthlyFeeSettings,
  saveMonthlyFeePlan,
  saveMonthlyFeeSettings,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { MonthlyFeeSubnav, rs } from './monthly-fee-ui';

const OFFLINE = ['CASH', 'UPI', 'BANK', 'CHEQUE', 'OTHER'] as const;
const DEFAULT_LOGO = '/school-sis/st-lukes-logo.png';

const inputClass =
  'mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none ring-[#2563eb]/20 placeholder:text-slate-400 focus:border-[#2563eb] focus:ring-4 disabled:bg-slate-50';

export function MonthlyFeeSettings() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const query = useQuery({
    queryKey: ['monthly-fee-config'],
    queryFn: fetchMonthlyFeeConfig,
    enabled,
  });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [dueDay, setDueDay] = useState('15');
  const [late, setLate] = useState('20');
  const [lateEnabled, setLateEnabled] = useState(true);
  const [signatory, setSignatory] = useState('');
  const [prefix, setPrefix] = useState('FB');
  const [schoolName, setSchoolName] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [refundPolicy, setRefundPolicy] = useState('');
  const [examInstructions, setExamInstructions] = useState('');
  const [otherNotes, setOtherNotes] = useState('');
  const [methods, setMethods] = useState<string[]>([...OFFLINE, 'ONLINE']);

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
    setRefundPolicy(s.refundPolicy ?? '');
    setExamInstructions(s.examInstructions ?? '');
    setOtherNotes(s.otherNotes ?? '');
    setMethods(s.paymentMethods?.length ? s.paymentMethods : [...OFFLINE, 'ONLINE']);
  }, [query.data?.settings]);

  const previewLogo = logoUrl || DEFAULT_LOGO;
  const yearName = query.data?.academicYear.name ?? '—';
  const online = query.data?.onlinePayments;

  function persist() {
    setOk(null);
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
      refundPolicy,
      examInstructions,
      otherNotes,
    })
      .then(() => {
        setError(null);
        setOk('Fee rules saved.');
        void qc.invalidateQueries({ queryKey: ['monthly-fee-config'] });
      })
      .catch((err) => setError(apiErrorMessage(err)));
  }

  function onPickLogo(file: File | undefined) {
    if (!file || !canManage) return;
    if (file.size > 600_000) {
      setError('Logo must be under 600 KB. Use a PNG around 300×100 px.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-5">
      <MonthlyFeeSubnav />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2563eb] text-white shadow-sm">
            <Settings2 className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-[#1e3a8a]">Fee Configuration</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Setup general fee collection rules and receipt settings for your institution.
            </p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            Active
            <span className="ml-1 font-normal text-emerald-600/80">
              These settings are currently in use.
            </span>
          </span>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-100">
          {ok}
        </p>
      ) : null}
      {query.isLoading ? <p className="text-sm text-slate-500">Loading configuration…</p> : null}

      {query.data?.settings ? (
        <form
          className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"
          onSubmit={(e) => {
            e.preventDefault();
            persist();
          }}
        >
          <div className="space-y-4">
            <div className="flex gap-3 rounded-2xl bg-[#eef5ff] px-4 py-3 ring-1 ring-blue-100">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#2563eb]" />
              <div>
                <p className="text-sm font-semibold text-[#1e3a8a]">Academic Year {yearName}</p>
                <p className="mt-0.5 text-sm leading-5 text-slate-600">
                  Nursery–IV uses the junior fee book (tuition only, due by the 15th). Classes V–X
                  use the printed monthly book: tuition ₹600, computer ₹100, late fee ₹20, due by
                  the 10th. Changing amounts does not alter receipts already issued.
                </p>
              </div>
            </div>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                    <span className="text-lg">₹</span> Late Fee Collection
                  </h2>
                  <p className="mt-1 max-w-xl text-sm text-slate-500">
                    Turn this off if management decides not to collect late fees. Overdue months
                    will then show only tuition (and computer fee for V–X).
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                  <span
                    className={cn(
                      'relative inline-flex h-6 w-11 shrink-0 rounded-full transition',
                      lateEnabled ? 'bg-[#2563eb]' : 'bg-slate-300',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition',
                        lateEnabled ? 'left-[22px]' : 'left-0.5',
                      )}
                    />
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={lateEnabled}
                      disabled={!canManage}
                      onChange={(e) => setLateEnabled(e.target.checked)}
                    />
                  </span>
                  Collect late fees
                </label>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-2xl px-3 py-2 ring-1',
                    lateEnabled ? 'bg-rose-50 ring-rose-100' : 'bg-slate-50 ring-slate-100',
                  )}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-bold text-rose-500 shadow-sm">
                    ₹
                  </span>
                  <label className="flex-1 text-sm font-medium text-slate-700">
                    Late fee amount (₹)
                    <input
                      className="mt-0.5 h-8 w-full border-0 bg-transparent p-0 text-base font-semibold outline-none disabled:text-slate-400"
                      value={late}
                      onChange={(e) => setLate(e.target.value)}
                      disabled={!canManage || !lateEnabled}
                    />
                  </label>
                </div>
                <p className="flex items-start gap-2 self-center text-xs leading-5 text-slate-500">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  Charged after the due date (15th for Nursery–IV, 10th for Classes V–X) when late
                  fees are applicable.
                </p>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
                <FileText className="h-4 w-4 text-[#2563eb]" /> Receipt Settings
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-medium text-slate-700">
                  Due day of month (Nursery–IV) <span className="text-rose-500">*</span>
                  <input
                    className={inputClass}
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    disabled={!canManage}
                  />
                  <span className="mt-1 block text-xs font-normal text-slate-400">
                    Junior fee book: 15th
                  </span>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Receipt prefix <span className="text-rose-500">*</span>
                  <input
                    className={inputClass}
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    disabled={!canManage}
                  />
                  <span className="mt-1 block text-xs font-normal text-slate-400">
                    Example: FB, SL, ST, etc.
                  </span>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Authorized signatory
                  <input
                    className={inputClass}
                    value={signatory}
                    onChange={(e) => setSignatory(e.target.value)}
                    disabled={!canManage}
                  />
                  <span className="mt-1 block text-xs font-normal text-slate-400">
                    Name/Designation to be printed on receipts
                  </span>
                </label>
                <label className="text-sm font-medium text-slate-700 sm:col-span-1">
                  School name on receipt <span className="text-rose-500">*</span>
                  <input
                    className={inputClass}
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    disabled={!canManage}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                  Address <span className="text-rose-500">*</span>
                  <input
                    className={inputClass}
                    value={schoolAddress}
                    onChange={(e) => setSchoolAddress(e.target.value)}
                    disabled={!canManage}
                  />
                </label>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_200px] sm:items-end">
                <label className="text-sm font-medium text-slate-700">
                  Logo URL
                  <input
                    className={inputClass}
                    value={logoUrl.startsWith('data:') ? '' : logoUrl}
                    placeholder={
                      logoUrl.startsWith('data:')
                        ? 'Uploaded image (saved with rules)'
                        : DEFAULT_LOGO
                    }
                    onChange={(e) => setLogoUrl(e.target.value)}
                    disabled={!canManage}
                  />
                  <span className="mt-1 block text-xs font-normal text-slate-400">
                    Recommended size: 300 × 100 px (PNG)
                  </span>
                </label>
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      onPickLogo(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#eef5ff] px-4 text-sm font-semibold text-[#2563eb] ring-1 ring-blue-100 disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" /> Upload
                  </button>
                </div>
                <div className="relative rounded-xl bg-white p-2 ring-1 ring-slate-200">
                  {logoUrl ? (
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-full bg-white p-0.5 text-slate-400 ring-1 ring-slate-200"
                      onClick={() => canManage && setLogoUrl('')}
                      aria-label="Remove logo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewLogo} alt="" className="h-10 w-10 object-contain" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[#1e3a8a]">
                        {schoolName || 'School name'}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">Tura, Meghalaya</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <FileText className="h-4 w-4 text-[#2563eb]" /> Payment Methods
              </h2>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {OFFLINE.map((m) => (
                  <label
                    key={m}
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-[#2563eb]"
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
              <p className="mt-2 text-xs text-slate-400">
                Select the payment modes available for fee collection.
              </p>
              <label className="mt-3 flex items-start gap-2 rounded-xl bg-[#eef5ff] px-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4"
                  checked={methods.includes('ONLINE')}
                  disabled={!canManage}
                  onChange={(e) => {
                    setMethods((cur) =>
                      e.target.checked ? [...cur, 'ONLINE'] : cur.filter((x) => x !== 'ONLINE'),
                    );
                  }}
                />
                <span>
                  <span className="font-semibold text-slate-800">Online payment gateway</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {online?.available
                      ? `Uses the default gateway: ${online.gatewayName}.`
                      : 'Enable after configuring a default gateway.'}{' '}
                    <Link
                      href="/admin/school-sis/fees/gateways"
                      className="font-semibold text-[#2563eb]"
                    >
                      Manage gateways
                    </Link>
                  </span>
                </span>
              </label>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <FileText className="h-4 w-4 text-[#2563eb]" /> General Instructions (printed on
                receipt)
              </h2>
              <textarea
                className="mt-3 min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/15 disabled:bg-slate-50"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                disabled={!canManage}
              />
              <p className="mt-1 text-xs text-slate-400">
                These instructions will be printed at the bottom of the fee receipt (one per line).
              </p>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-600">
                  Additional receipt notes
                </summary>
                <div className="mt-3 grid gap-3">
                  <label className="text-sm font-medium text-slate-700">
                    Refund policy
                    <textarea
                      className="mt-1 min-h-16 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={refundPolicy}
                      onChange={(e) => setRefundPolicy(e.target.value)}
                      disabled={!canManage}
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Examination-related instructions
                    <textarea
                      className="mt-1 min-h-16 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={examInstructions}
                      onChange={(e) => setExamInstructions(e.target.value)}
                      disabled={!canManage}
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Other notes
                    <textarea
                      className="mt-1 min-h-16 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={otherNotes}
                      onChange={(e) => setOtherNotes(e.target.value)}
                      disabled={!canManage}
                    />
                  </label>
                </div>
              </details>
            </section>

            {canManage ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-400">
                  Last updated by {query.data.updatedBy ?? '—'}
                  {query.data.updatedAt
                    ? ` · ${new Date(query.data.updatedAt).toLocaleString('en-IN')}`
                    : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-[#1e3a8a] px-6 text-sm font-semibold text-white shadow-sm"
                  >
                    <Save className="h-4 w-4" /> Save Rules
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200"
                    onClick={() => {
                      if (!window.confirm('Reset fee rules to school defaults?')) return;
                      void resetMonthlyFeeSettings()
                        .then(() => {
                          setError(null);
                          setOk('Reset to default rules.');
                          void qc.invalidateQueries({ queryKey: ['monthly-fee-config'] });
                        })
                        .catch((err) => setError(apiErrorMessage(err)));
                    }}
                  >
                    <RotateCcw className="h-4 w-4" /> Reset to Default
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="space-y-3 xl:sticky xl:top-4">
            <div className="flex gap-3 rounded-2xl bg-[#eef5ff] p-4 ring-1 ring-blue-100">
              <BookOpen className="h-8 w-8 shrink-0 text-[#2563eb]" />
              <p className="text-sm leading-5 text-slate-600">
                Configure the global rules used for fee collection, due dates and receipt
                generation.
              </p>
            </div>
            <div className="rounded-2xl bg-[#fffbeb] p-4 ring-1 ring-amber-100">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Lightbulb className="h-4 w-4 text-amber-500" /> Quick Guidelines
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {[
                  'Nursery–IV: Junior fee book (tuition only), due by the 15th.',
                  'Classes V–X: Printed monthly book (tuition ₹600, computer ₹100), due by the 10th.',
                  'Late fee applies after the due date.',
                  'Changing these settings does not affect already issued receipts.',
                  'Fees once paid are not refundable.',
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-[#ecfdf5] p-4 ring-1 ring-emerald-100">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Preview Receipt Header
              </p>
              <p className="mt-1 text-xs text-slate-500">
                This is how the school name will appear on receipts.
              </p>
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-emerald-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewLogo} alt="" className="h-12 w-12 object-contain" />
                <div>
                  <p className="text-sm font-bold text-[#1e3a8a]">
                    {schoolName || "St. Luke's Secondary School"}
                  </p>
                  <p className="text-xs leading-4 text-slate-500">
                    {schoolAddress || 'Walbakgre, Tura - 794101, West Garo Hills, Meghalaya'}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-[#f5f3ff] p-4 ring-1 ring-violet-100">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <HelpCircle className="h-4 w-4 text-violet-500" /> Need Help?
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Contact the system administrator if you are unsure about any of the settings.
              </p>
              <a
                href="mailto:support@stlukestura.in"
                className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-violet-700 ring-1 ring-violet-100"
              >
                <Mail className="h-4 w-4" /> Contact Support
              </a>
            </div>
            <div className="rounded-2xl bg-[#fff7ed] p-4 ring-1 ring-orange-100">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <AlertTriangle className="h-4 w-4 text-orange-500" /> Important
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Always verify the settings before starting a new academic year. Incorrect
                configuration may affect fee collection and receipt generation.
              </p>
            </div>
          </aside>
        </form>
      ) : null}

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Monthly plan amounts</h2>
          <p className="text-sm text-slate-500">
            Tuition and computer/other fee by class. Not shown on the receipt header.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2">Class</th>
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
        </div>
        {query.data && !query.data.plans.length ? (
          <p className="p-6 text-center text-sm text-slate-500">
            No Nursery–X classes found for this academic year.
          </p>
        ) : null}
      </section>
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
    <tr className="border-t border-slate-100">
      <td className="px-5 py-2 font-medium">{plan.grade.name}</td>
      <td className="px-3 py-2">
        <input
          className="h-9 w-28 rounded-lg border border-slate-200 px-2"
          value={tuition}
          onChange={(e) => setTuition(e.target.value)}
          disabled={!canManage}
        />
      </td>
      <td className="px-3 py-2">
        <input
          className="h-9 w-28 rounded-lg border border-slate-200 px-2"
          value={other}
          onChange={(e) => setOther(e.target.value)}
          disabled={!canManage}
        />
      </td>
      <td className="px-3 py-2">
        {canManage ? (
          <button
            type="button"
            className="text-sm font-semibold text-[#2563eb]"
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
