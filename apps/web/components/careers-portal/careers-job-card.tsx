import Link from 'next/link';
import { Calendar, MapPin, Users } from 'lucide-react';
import type { CareersJob } from '@/services/careers-portal';
import { formatSalaryRange } from '@/services/careers-portal';
import { formatEmploymentType } from '@/lib/careers-portal/constants';
import { cn } from '@/utils/cn';

export function CareersJobCard({
  job,
  variant = 'default',
}: {
  job: CareersJob;
  variant?: 'default' | 'featured';
}) {
  const slug = job.slug ?? job.id;
  const closing = job.closingDate
    ? new Date(job.closingDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-2xl border transition duration-300',
        variant === 'featured'
          ? 'border-white/15 bg-white text-slate-900 shadow-xl hover:-translate-y-1 hover:shadow-2xl'
          : 'border-slate-200 bg-white text-slate-900 shadow-md hover:border-[#1e3a5f]/30 hover:shadow-lg',
      )}
    >
      <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#1e3a5f] to-[#c8102e]" />
      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold leading-snug group-hover:text-[#1e3a5f]">
              {job.title}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {job.department?.name ?? 'Don Bosco College'}
              {job.designation?.label ? ` · ${job.designation.label}` : ''}
            </p>
          </div>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-[#1e3a5f]">
            {formatEmploymentType(job.staffType)}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <Users className="h-4 w-4 text-slate-400" />
            <span>
              {job.vacanciesCount} position{job.vacanciesCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <MapPin className="h-4 w-4 text-slate-400" />
            <span>Tura, Meghalaya</span>
          </div>
          {closing ? (
            <div className="col-span-2 flex items-center gap-2 text-slate-600">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span>Last date: {closing}</span>
            </div>
          ) : null}
        </div>

        <p className="mt-4 text-sm font-semibold text-[#1e3a5f]">{formatSalaryRange(job)}</p>
        {job.qualificationRequired ? (
          <p className="mt-2 line-clamp-2 text-xs text-slate-500">{job.qualificationRequired}</p>
        ) : null}

        <Link
          href={`/careers-portal/jobs/${slug}`}
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#152a45]"
        >
          Apply Now
        </Link>
      </div>
    </article>
  );
}
