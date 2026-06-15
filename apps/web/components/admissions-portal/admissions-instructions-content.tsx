'use client';

import type { PortalInfo } from '@/services/admissions-portal';
import {
  formatInr,
  parsePortalCycleSettings,
  resolvePortalCycleSettings,
  type PortalCycleSettings,
} from '@/components/admissions-portal/cycle-settings';
import { cn } from '@/utils/cn';

type Props = {
  info?: PortalInfo | null;
  cycleSettings?: PortalCycleSettings;
  applicantCycleSettings?: Record<string, unknown> | null;
  className?: string;
};

export function AdmissionsInstructionsContent({
  info,
  cycleSettings,
  applicantCycleSettings,
  className,
}: Props) {
  const settings =
    cycleSettings ??
    (applicantCycleSettings
      ? parsePortalCycleSettings(applicantCycleSettings)
      : resolvePortalCycleSettings({ portalInfo: info }));

  return (
    <div className={cn('space-y-6', className)}>
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
        <strong>Important:</strong> Registration on this portal does not guarantee admission.
        Selection is based on merit, eligibility, and committee decision.
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[#1a2b4b]">Online admission process (2026–2027)</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-slate-700">
          <li>
            <strong>Register</strong> with full name (as per Class X), date of birth, gender, email,
            mobile number, and profile photo. Save your application number and password.
          </li>
          <li>
            <strong>Complete the 7-step form</strong> — personal details, addresses, family,
            academic records, course preferences (major, minor, MDC, AEC, SEC, VAC), and uploads.
          </li>
          <li>
            <strong>Pay the application fee</strong> ({formatInr(settings.applicationFee)}) online
            or at the college office <strong>before submitting</strong> your application.
          </li>
          <li>
            <strong>Upload documents</strong> — Class X &amp; XII marksheets, CUET (if applicable),
            and category certificates where relevant.
          </li>
          <li>
            <strong>Submit</strong> the application before the deadline. Track verification and
            merit on the Application Status page.
          </li>
          <li>
            <strong>If you are selected for admission</strong>, pay the admission fee (amount as
            directed by the college; minimum guideline {formatInr(settings.admissionFeeMin)}) before
            enrollment.
          </li>
        </ol>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <DeadlineCard
          label="Registration closes"
          value={info?.registrationClosesAt ?? info?.cycle?.registrationClosesAt}
        />
        <DeadlineCard
          label="Application deadline"
          value={info?.applicationDeadline ?? info?.cycle?.applicationDeadline}
        />
        <DeadlineCard
          label="Payment deadline"
          value={info?.paymentDeadline ?? info?.cycle?.paymentDeadline}
        />
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Application fee</p>
          <p className="mt-1 text-lg font-semibold text-[#1a2b4b]">
            {formatInr(settings.applicationFee)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Non-refundable registration fee (before submit)
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
        <h3 className="font-semibold text-[#1a2b4b]">Document checklist</h3>
        <ul className="mt-3 list-inside list-disc space-y-1">
          <li>Recent passport-size photograph (uploaded at registration)</li>
          <li>Class X marksheet (JPEG/PNG/PDF, max 5 MB)</li>
          <li>Class XII marksheet (JPEG/PNG/PDF, max 5 MB)</li>
          <li>CUET scorecard (if applicable)</li>
          <li>Disability / EWS certificates (if claiming reservation benefits)</li>
        </ul>
      </section>

      <section className="rounded-xl border border-sky-200 bg-sky-50 p-5 text-sm">
        <h3 className="font-semibold text-[#1a2b4b]">Need help?</h3>
        <p className="mt-2 text-slate-700">
          Contact the admissions help desk during college working hours.
        </p>
        <p className="mt-2 font-medium text-[#2563eb]">Phone: {settings.helpDesk.phone}</p>
        {settings.helpDesk.email ? (
          <p className="text-[#2563eb]">Email: {settings.helpDesk.email}</p>
        ) : null}
        <p className="mt-3 text-xs text-slate-600">
          ADMISSIONS OFFICE · Meghalaya — 794002 · Ph. 03651-222361 · principaldbct@gmail.com
        </p>
      </section>
    </div>
  );
}

function DeadlineCard({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-[#1a2b4b]">{formatDate(value)}</p>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return 'To be announced';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
