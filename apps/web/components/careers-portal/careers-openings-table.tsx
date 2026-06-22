'use client';

import Link from 'next/link';
import type { CareersJob } from '@/services/careers-portal';

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
}: {
  jobs: CareersJob[];
  emptyMessage?: string;
}) {
  if (!jobs.length) {
    return <p className="py-8 text-center text-slate-400">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-white/15 text-xs font-semibold uppercase tracking-wider text-slate-400">
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
              <tr key={job.id} className="border-b border-white/8 transition hover:bg-white/[0.03]">
                <td className="py-4 pr-4 font-medium text-white">{job.title}</td>
                <td className="py-4 pr-4 text-slate-300">{job.department?.name ?? 'General'}</td>
                <td className="py-4 pr-4 text-slate-300">{job.vacanciesCount}</td>
                <td className="py-4 pr-4 text-slate-300">{formatClosingDate(job.closingDate)}</td>
                <td className="py-4">
                  <Link
                    href={`/careers-portal/jobs/${slug}`}
                    className="inline-flex rounded-full bg-[#c8102e] px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-[#a50d25]"
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
