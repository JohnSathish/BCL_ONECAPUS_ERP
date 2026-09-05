'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SchoolOfficeStatusBadgeRow } from '@/components/school-office/status-badge';
import type { SchoolOfficeStatusBadge } from '@/lib/school-office/application-status';

export function ApplicantProfileHeader({
  applicationNumber,
  candidateName,
  sessionLabel = 'K.G. Admission – Academic Session 2027',
  badges,
  indexNumber,
  onDownloadPdf,
  onResendEmail,
  busy,
}: {
  applicationNumber: string;
  candidateName: string;
  sessionLabel?: string;
  badges: SchoolOfficeStatusBadge[];
  indexNumber?: string | null;
  onDownloadPdf: () => void;
  onResendEmail: () => void;
  busy?: boolean;
}) {
  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/admin/school-admissions"
          className="text-sm font-medium text-[var(--school-erp-primary)] underline"
        >
          ← Back to Applications
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onDownloadPdf}>
            Download Application PDF
          </Button>
          <Button type="button" variant="outline" onClick={() => window.print()}>
            Print
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={onResendEmail}>
            Resend PDF by Email
          </Button>
        </div>
      </div>

      <div>
        <p className="font-mono text-sm font-semibold text-[var(--school-erp-primary)]">
          {applicationNumber}
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">
          {candidateName}
        </h1>
        <p className="mt-1 text-sm text-[var(--school-erp-muted)]">{sessionLabel}</p>
        {indexNumber ? (
          <p className="mt-1 text-sm font-medium text-emerald-800">Index Number: {indexNumber}</p>
        ) : null}
      </div>

      <SchoolOfficeStatusBadgeRow badges={badges} />
    </div>
  );
}

export function ProfileSectionCard({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--school-erp-primary)]">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function ProfileFieldGrid({
  fields,
}: {
  fields: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.label}>
          <dt className="text-xs text-muted-foreground">{field.label}</dt>
          <dd className="mt-0.5 text-sm text-slate-900">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function displayField(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return '—';
}
