'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { CareersJob } from '@/services/careers-portal';

export function CareersDepartmentHiring({ jobs }: { jobs: CareersJob[] }) {
  const hiringDepts = useMemo(() => {
    const names = new Set<string>();
    for (const job of jobs) {
      if (job.department?.name) names.add(job.department.name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  if (!hiringDepts.length) return null;

  return (
    <section className="border-t border-white/10 py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-400/90">
        Openings by department
      </p>
      <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
        Departments Currently Hiring
      </h2>
      <p className="mt-3 max-w-2xl text-slate-400">
        These academic departments have published vacancies at Don Bosco College, Tura.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        {hiringDepts.map((name) => (
          <Link
            key={name}
            href={`/careers-portal/jobs?department=${encodeURIComponent(name)}`}
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-amber-400/40 hover:text-white"
          >
            {name}
          </Link>
        ))}
      </div>
    </section>
  );
}
