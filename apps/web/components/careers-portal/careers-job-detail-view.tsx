'use client';

import Link from 'next/link';
import {
  Briefcase,
  ChevronDown,
  Clock,
  FileText,
  GraduationCap,
  IndianRupee,
  MapPin,
} from 'lucide-react';
import type { CareersJob } from '@/services/careers-portal';
import { formatSalaryRange } from '@/services/careers-portal';
import { formatEmploymentType } from '@/lib/careers-portal/constants';
import { CareersApplicationWizard } from '@/components/careers-portal/careers-application-wizard';
import { Button } from '@/components/ui/button';

const DOCUMENTS_REQUIRED = [
  'Resume / CV (PDF)',
  'Passport-size photograph',
  'Educational certificates (UG, PG)',
  'Experience certificates (if applicable)',
  'NET / SET certificate (if applicable)',
  'Identity proof (Aadhaar / Voter ID)',
];

export function CareersJobDetailView({ job }: { job: CareersJob }) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-12 lg:gap-6">
      {/* Form first / dominant */}
      <div className="order-1 lg:col-span-7 xl:col-span-8">
        <CareersApplicationWizard job={job} />
      </div>

      {/* Compact job brief */}
      <aside className="order-2 space-y-3 lg:sticky lg:top-24 lg:col-span-5 xl:col-span-4">
        <div className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-[#0a1628] via-[#0f2138] to-[#0a1628] p-4 shadow-[0_0_40px_rgba(34,211,238,0.08)] sm:p-5">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-400/10 blur-2xl"
          />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/90">
            {job.department?.name ?? 'Don Bosco College'}
          </p>
          <h1 className="mt-1.5 text-xl font-bold leading-snug text-white sm:text-2xl">
            {job.title}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {job.designation?.label ?? formatEmploymentType(job.staffType)}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <MetaChip icon={Briefcase} label="Type" value={formatEmploymentType(job.staffType)} />
            <MetaChip icon={GraduationCap} label="Vacancies" value={`${job.vacanciesCount}`} />
            <MetaChip icon={MapPin} label="Location" value="Tura, Meghalaya" />
            <MetaChip icon={IndianRupee} label="Salary" value={formatSalaryRange(job)} />
            {job.closingDate ? (
              <MetaChip
                icon={Clock}
                label="Deadline"
                value={new Date(job.closingDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
                className="col-span-2"
              />
            ) : null}
          </div>
        </div>

        <CompactDisclosure title="Position Overview" defaultOpen>
          <div
            className="prose prose-invert prose-sm max-w-none text-slate-300 prose-p:my-1.5 prose-headings:text-white"
            dangerouslySetInnerHTML={{
              __html:
                job.jobDescriptionHtml ??
                `<p>${job.description ?? 'Detailed job description will be updated shortly.'}</p>`,
            }}
          />
        </CompactDisclosure>

        <CompactDisclosure title="Eligibility">
          <ul className="space-y-1.5 text-sm text-slate-300">
            <li>
              <span className="font-medium text-cyan-200">Qualification:</span>{' '}
              {job.qualificationRequired ?? 'As per UGC / college norms'}
            </li>
            <li>
              <span className="font-medium text-cyan-200">Experience:</span>{' '}
              {job.experienceRequired ?? 'As required for the post'}
            </li>
          </ul>
        </CompactDisclosure>

        <CompactDisclosure title="Documents Required">
          <ul className="grid gap-1.5">
            {DOCUMENTS_REQUIRED.map((doc) => (
              <li key={doc} className="flex items-center gap-2 text-xs text-slate-300">
                <FileText className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                {doc}
              </li>
            ))}
          </ul>
        </CompactDisclosure>

        {(job.advertisementPdfUrl || job.termsPdfUrl) && (
          <div className="flex flex-wrap gap-2">
            {job.advertisementPdfUrl ? (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-8 border-cyan-400/30 bg-cyan-400/5 text-xs text-cyan-100 hover:bg-cyan-400/10"
              >
                <a href={job.advertisementPdfUrl} target="_blank" rel="noreferrer">
                  Advertisement PDF
                </a>
              </Button>
            ) : null}
            {job.termsPdfUrl ? (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-8 border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"
              >
                <a href={job.termsPdfUrl} target="_blank" rel="noreferrer">
                  Terms
                </a>
              </Button>
            ) : null}
          </div>
        )}

        <Link
          href="/careers-portal/jobs"
          className="inline-flex text-xs text-cyan-300/90 transition hover:text-white"
        >
          ← All openings
        </Link>
      </aside>
    </div>
  );
}

function MetaChip({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 ${className ?? ''}`}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
        <p className="truncate text-xs font-medium text-slate-100">{value}</p>
      </div>
    </div>
  );
}

function CompactDisclosure({
  title,
  children,
  defaultOpen,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-white/10 bg-white/[0.04] open:bg-white/[0.06]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5 text-sm font-semibold text-white marker:content-none [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="h-4 w-4 shrink-0 text-cyan-300/80 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-white/5 px-3.5 pb-3.5 pt-2">{children}</div>
    </details>
  );
}
