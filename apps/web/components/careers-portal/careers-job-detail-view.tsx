'use client';

import Link from 'next/link';
import { Briefcase, Clock, FileText, GraduationCap, IndianRupee, MapPin } from 'lucide-react';
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
    <div className="grid gap-8 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <div className="rounded-2xl border border-white/10 bg-white p-6 text-slate-900 shadow-xl sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#c8102e]">
            {job.department?.name ?? 'Don Bosco College'}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#1e3a5f] sm:text-3xl">{job.title}</h1>
          <p className="mt-2 text-slate-600">
            {job.designation?.label ?? formatEmploymentType(job.staffType)}
          </p>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <Detail
              icon={Briefcase}
              label="Employment Type"
              value={formatEmploymentType(job.staffType)}
            />
            <Detail
              icon={GraduationCap}
              label="Vacancies"
              value={`${job.vacanciesCount} position(s)`}
            />
            <Detail icon={MapPin} label="Location" value="Don Bosco College, Tura, Meghalaya" />
            <Detail icon={IndianRupee} label="Salary Range" value={formatSalaryRange(job)} />
            {job.closingDate ? (
              <Detail
                icon={Clock}
                label="Application Deadline"
                value={new Date(job.closingDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              />
            ) : null}
          </dl>
        </div>

        <Section title="Position Overview">
          <div
            className="prose prose-slate max-w-none text-sm"
            dangerouslySetInnerHTML={{
              __html:
                job.jobDescriptionHtml ??
                `<p>${job.description ?? 'Detailed job description will be updated shortly.'}</p>`,
            }}
          />
        </Section>

        <Section title="Eligibility">
          <ul className="space-y-2 text-sm text-slate-300">
            <li>
              <strong className="text-white">Qualification:</strong>{' '}
              {job.qualificationRequired ?? 'As per UGC / college norms'}
            </li>
            <li>
              <strong className="text-white">Experience:</strong>{' '}
              {job.experienceRequired ?? 'As required for the post'}
            </li>
          </ul>
        </Section>

        <Section title="Documents Required">
          <ul className="grid gap-2 sm:grid-cols-2">
            {DOCUMENTS_REQUIRED.map((doc) => (
              <li key={doc} className="flex items-center gap-2 text-sm text-slate-300">
                <FileText className="h-4 w-4 shrink-0 text-sky-400" />
                {doc}
              </li>
            ))}
          </ul>
        </Section>

        {(job.advertisementPdfUrl || job.termsPdfUrl) && (
          <div className="flex flex-wrap gap-3">
            {job.advertisementPdfUrl ? (
              <Button asChild variant="outline" className="border-white/20 bg-white/10 text-white">
                <a href={job.advertisementPdfUrl} target="_blank" rel="noreferrer">
                  Official Advertisement
                </a>
              </Button>
            ) : null}
            {job.termsPdfUrl ? (
              <Button asChild variant="outline" className="border-white/20 bg-white/10 text-white">
                <a href={job.termsPdfUrl} target="_blank" rel="noreferrer">
                  Terms & Conditions
                </a>
              </Button>
            ) : null}
          </div>
        )}

        <Link href="/careers-portal/jobs" className="text-sm text-sky-300 hover:text-white">
          ← Back to all openings
        </Link>
      </div>

      <div className="lg:col-span-2">
        <div className="sticky top-24">
          <CareersApplicationWizard job={job} />
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl bg-slate-50 p-3">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#1e3a5f]" />
      <div>
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="text-sm font-medium text-slate-900">{value}</dd>
      </div>
    </div>
  );
}
