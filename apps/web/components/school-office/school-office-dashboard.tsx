'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { SCHOOL_CASTE_CATEGORY_POLICY } from '@/lib/school-admission-category';
import { fetchSchoolOfficeSummary } from '@/services/school-admissions';

export function SchoolOfficeDashboard() {
  const enabled = useAuthQueryEnabled();
  const summary = useQuery({
    queryKey: ['school-office-summary'],
    queryFn: fetchSchoolOfficeSummary,
    enabled,
  });
  const data = summary.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#1b4d3e]">Tura Public School dashboard</h2>
        <p className="mt-1 text-sm text-slate-600">
          School admissions office — this is not the college FYUP ERP.
        </p>
      </div>
      <div
        className={`rounded-2xl border px-4 py-3 ${
          data?.admissionWindow?.isOpen
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-rose-200 bg-rose-50 text-rose-900'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">
              {data?.admissionWindow?.isOpen ? '🟢 Admissions Open' : '🔴 Admissions Closed'}
            </p>
            <p className="mt-1 text-sm">
              {data?.admissionWindow?.message ?? 'Loading admission window…'}
            </p>
            {data?.admissionWindow?.lastDateLabel ? (
              <p className="mt-1 text-sm">Closing Date: {data.admissionWindow.lastDateLabel}</p>
            ) : null}
            {typeof data?.admissionWindow?.maxOnlineApplications === 'number' ? (
              <p className="mt-1 text-sm">
                Applications: {data.admissionWindow.applicationCount ?? 0} /{' '}
                {data.admissionWindow.maxOnlineApplications}
                {typeof data.admissionWindow.seatsRemaining === 'number'
                  ? ` · ${data.admissionWindow.seatsRemaining} remaining`
                  : ''}
              </p>
            ) : null}
          </div>
          <Link
            href="/admin/school-admissions/admission-settings"
            className="rounded-full bg-[#1b4d3e] px-4 py-2 text-sm font-medium text-white hover:bg-[#14382d]"
          >
            Admission Settings
          </Link>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total applications" value={data?.total} />
        <Stat label="Draft / in progress" value={data?.draft} />
        <Stat label="Submitted" value={data?.submitted} />
        <Stat label="Under review" value={data?.underReview} />
        <Stat label="Fee paid" value={data?.paid} />
        <Stat label="Payment pending" value={data?.pendingPayment} />
        <Stat label="Admission granted" value={data?.granted} />
        <Stat label="Not granted" value={data?.notGranted} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[#1b4d3e]">Applications by Caste / Category</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SCHOOL_CASTE_CATEGORY_POLICY.map((item) => (
            <Link
              key={item.code}
              href={`/admin/school-admissions?category=${item.code}`}
              className="rounded-2xl border border-[#1b4d3e]/15 bg-white p-4 shadow-sm hover:border-[#1b4d3e]/40"
            >
              <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold text-[#1b4d3e]">
                {data?.byCategory?.[item.code] ?? '—'}
              </p>
            </Link>
          ))}
        </div>
        {data?.uncategorised ? (
          <p className="mt-2 text-xs text-slate-500">
            {data.uncategorised} application{data.uncategorised === 1 ? '' : 's'} without a selected
            category.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/school-admissions"
          className="rounded-full bg-[#1b4d3e] px-4 py-2 text-sm font-medium text-white hover:bg-[#14382d]"
        >
          Open K.G. applications
        </Link>
        <Link
          href="/admin/school-admissions/admission-settings"
          className="rounded-full border border-[#1b4d3e]/30 bg-white px-4 py-2 text-sm font-medium text-[#1b4d3e] hover:bg-[#1b4d3e]/5"
        >
          Admission Settings
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-2xl border border-[#1b4d3e]/15 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#1b4d3e]">{value ?? '—'}</p>
    </div>
  );
}
