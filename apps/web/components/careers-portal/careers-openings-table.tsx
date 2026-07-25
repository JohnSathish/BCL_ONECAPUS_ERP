'use client';

import Link from 'next/link';
import type { CareersJob } from '@/services/careers-portal';
import { cn } from '@/utils/cn';

function formatClosingDate(iso?: string | null) {
  if (!iso) return 'Open';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function CareersOpeningsTable({
  jobs,
  emptyMessage = 'No vacancies published at the moment.',
  tone = 'dark',
}: {
  jobs: CareersJob[];
  emptyMessage?: string;
  tone?: 'dark' | 'light';
}) {
  const light = tone === 'light';

  if (!jobs.length) {
    return (
      <p className={cn('py-8 text-center', light ? 'text-slate-500' : 'text-slate-400')}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr
            className={cn(
              'border-b text-xs font-semibold uppercase tracking-wider',
              light ? 'border-slate-200 text-slate-500' : 'border-white/15 text-slate-400',
            )}
          >
            <th className="pb-4 pr-4 font-semibold">Position</th>
            <th className="pb-4 pr-4 font-semibold">Department</th>
            <th className="pb-4 pr-4 font-semibold">Vacancies</th>
            <th className="pb-4 pr-4 font-semibold">Last Date</th>
            <th className="pb-4 font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const slug = job.slug ?? job.id;
            return (
              <tr
                key={job.id}
                className={cn(
                  'border-b transition',
                  light
                    ? 'border-slate-100 hover:bg-[#fffbf0]'
                    : 'border-white/8 hover:bg-white/[0.03]',
                )}
              >
                <td
                  className={cn('py-4 pr-4 font-medium', light ? 'text-[#0b1f4a]' : 'text-white')}
                >
                  {job.title}
                </td>
                <td className={cn('py-4 pr-4', light ? 'text-slate-600' : 'text-slate-300')}>
                  {job.department?.name ?? 'General'}
                </td>
                <td className={cn('py-4 pr-4', light ? 'text-slate-600' : 'text-slate-300')}>
                  {job.vacanciesCount}
                </td>
                <td className={cn('py-4 pr-4', light ? 'text-slate-600' : 'text-slate-300')}>
                  {formatClosingDate(job.closingDate)}
                </td>
                <td className="py-4">
                  <Link
                    href={`/careers-portal/jobs/${slug}`}
                    className={cn(
                      'inline-flex rounded-full px-4 py-1.5 text-sm font-semibold text-white transition',
                      light ? 'bg-[#0b1f4a] hover:bg-[#152a5c]' : 'bg-[#c8102e] hover:bg-[#a50d25]',
                    )}
                  >
                    Apply
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
